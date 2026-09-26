import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository, DataBaseService, Not, Repository } from '@wlisfes/chat-web-base-schema/database'
import { isEmpty, isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
import * as ChunkDto from '@/modules/chunk/dto/chunk.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'
import * as feign from '@wlisfes/chat-web-base-schema/feign'

/** Skyline 枚举字典工具服务：沉淀查询补充、选项树组装与业务校验等公共逻辑。 */
@Injectable()
export class ChunkUtilsService {
    constructor(
        @InjectRepository(Schema.TbSkylineChunk) private readonly repository: Repository<Schema.TbSkylineChunk>,
        @InjectRepository(Schema.TbSkylineChunkModuleEntity)
        private readonly moduleRepository: Repository<Schema.TbSkylineChunkModuleEntity>,
        private readonly database: DataBaseService
    ) {}

    /** 按 module + type 联查子表 tb_skyline_chunk，为当前页枚举分类补充枚举项数量。 */
    public async appendChunkCount(list: Array<Schema.TbSkylineChunkModuleEntity>): Promise<Array<ChunkDto.ChunkModuleResponseDto>> {
        if (list.length === 0) {
            return []
        }
        return this.database.builder(this.repository, async qb => {
            qb.select('t.module', 'module')
            qb.addSelect('t.type', 'type')
            qb.addSelect('COUNT(t.keyId)', 'count')
            qb.where('t.type IN (:...types)', { types: [...new Set(list.map(item => item.type))] })
            qb.groupBy('t.module')
            qb.addGroupBy('t.type')
            return await qb.getRawMany<{ module: Schema.TbSkylineChunkModule; type: string; count: string | number }>().then(rows => {
                // 以 module:type 作为键汇总数量，未命中的分类数量为 0。
                const counts = new Map(rows.map(row => [`${row.module}:${row.type}`, Number(row.count)]))
                return list.map(item => ({ ...item, chunkCount: counts.get(`${item.module}:${item.type}`) ?? 0 }))
            })
        })
    }

    /**
     * 把扁平枚举项按 pid 组装成选项树。
     *
     * rootPid 表示本次组装的根节点父级，pid 等于它、为空或指向集合外节点的枚举项都作为根节点返回，
     * 避免单个枚举项父级被禁用时整组选项丢失。
     */
    public buildOptionTree(entities: Schema.TbSkylineChunk[], rootPid?: number): feign.SkylineChunkOption[] {
        const options = new Map<number, feign.SkylineChunkOption>()
        for (const entity of entities) {
            options.set(entity.keyId, this.toOption(entity))
        }

        const roots: feign.SkylineChunkOption[] = []
        for (const entity of entities) {
            const option = options.get(entity.keyId) as feign.SkylineChunkOption
            const parent = isNotEmpty(entity.pid) && entity.pid !== rootPid ? options.get(entity.pid) : undefined
            if (parent) {
                parent.children.push(option)
            } else {
                roots.push(option)
            }
        }

        return roots
    }

    /** 把枚举实体转换为统一的下拉选项结构；description 取自扩展配置，缺省时回落为显示名称。 */
    public toOption(entity: Schema.TbSkylineChunk): feign.SkylineChunkOption {
        const description = entity.json.description
        return {
            value: entity.value,
            label: entity.name,
            description: typeof description === 'string' ? description : entity.name,
            keyId: entity.keyId,
            pid: entity.pid,
            sort: entity.sort,
            json: entity.json,
            children: []
        }
    }

    /** 校验枚举分类（module + type）已在分类表中维护。 */
    public async assertModuleType(module: Schema.TbSkylineChunkModule, type: string): Promise<void> {
        const found = await this.moduleRepository.findOne({ where: { module, type } })
        if (!found) {
            throw new BadRequestException('枚举分类不存在')
        }
    }

    /** 按主键查询枚举项，不存在时抛出异常。 */
    public async findRequired(keyId: number): Promise<Schema.TbSkylineChunk> {
        const entity = await this.repository.findOne({ where: { keyId } })
        if (!entity) {
            throw new NotFoundException('枚举项不存在')
        }
        return entity
    }

    /** 校验父枚举项存在、不能指向自身，且必须属于同一模块。 */
    public async assertParent(pid?: number | null, module?: Schema.TbSkylineChunkModule, keyId?: number): Promise<void> {
        if (isEmpty(pid)) {
            return
        }
        if (isNotEmpty(keyId) && pid === keyId) {
            throw new BadRequestException('枚举项不能将自身设置为父节点')
        }
        const parent = await this.repository.findOne({ where: { keyId: pid } })
        if (!parent) {
            throw new NotFoundException('父枚举项不存在')
        }
        if (isNotEmpty(module) && parent.module !== module) {
            throw new BadRequestException('父枚举项必须属于同一模块')
        }
    }

    /** 同一模块、同一类型下的业务值必须唯一。 */
    public async assertUnique(module: Schema.TbSkylineChunkModule, type: string, value: string, excludeKeyId?: number): Promise<void> {
        const where: Record<string, unknown> = { module, type, value }
        if (isNotEmpty(excludeKeyId)) {
            where.keyId = Not(excludeKeyId)
        }
        const existing = await this.repository.findOne({ where })
        if (existing) {
            throw new BadRequestException('同一模块下该类型的业务值已存在')
        }
    }
}
