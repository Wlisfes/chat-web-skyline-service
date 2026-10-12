import { InjectRepository, DataBaseService, Not, Repository } from '@wlisfes/chat-web-base-schema/database'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as utils from '@wlisfes/chat-web-base-schema/utils'
import * as feign from '@wlisfes/chat-web-base-schema/feign'
import * as ChunkDto from '@/modules/chunk/dto/chunk.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'

@Injectable()
export class ChunkUtilsService {
    constructor(
        @InjectRepository(Schema.TbSkylineChunk) private readonly repository: Repository<Schema.TbSkylineChunk>,
        @InjectRepository(Schema.TbSkylineChunkModuleEntity)
        private readonly moduleRepository: Repository<Schema.TbSkylineChunkModuleEntity>,
        private readonly database: DataBaseService,
        private readonly skylineFeignClient: feign.FeignClientSkylineManager,
        private readonly configService: ConfigService
    ) {}

    /**
     * 按 module + type 联查子表 tb_skyline_chunk，为当前页枚举分类补充枚举项数量和最近更新信息。
     * 更新人、更新时间取子表中对应分类最新一条枚举项（modifyTime 倒序，相同时 keyId 倒序）；
     * 创建人、创建时间保持分类表原值，分类下没有枚举项时更新人、更新时间也保持分类表原值。
     * 更新人最终确定后，再通过 Skyline 账号 Feign 批量把创建人、更新人还原为 createByOptions、modifyByOptions。
     */
    public async appendChunkStatistics(list: Array<Schema.TbSkylineChunkModuleEntity>): Promise<Array<ChunkDto.ChunkModuleResponseDto>> {
        if (list.length === 0) {
            return []
        }
        return this.database.builder(this.repository, async qb => {
            qb.select(['t.keyId', 't.module', 't.type', 't.modifyBy', 't.modifyTime'])
            qb.where('t.type IN (:...types)', { types: [...new Set(list.map(item => item.type))] })
            qb.orderBy('t.modifyTime', 'DESC')
            qb.addOrderBy('t.keyId', 'DESC')
            return await qb.getMany().then(async rows => {
                // 以 module:type 作为键汇总；rows 已按最新排序，同一分类首次出现的枚举项即最新一条。
                const statistics = new Map<string, { count: number; latest: Schema.TbSkylineChunk }>()
                for (const row of rows) {
                    const key = `${row.module}:${row.type}`
                    const current = statistics.get(key)
                    if (current) {
                        current.count += 1
                    } else {
                        statistics.set(key, { count: 1, latest: row })
                    }
                }
                // 直接在原列表项上追加统计字段，最终返回原 list。
                const records = list as Array<ChunkDto.ChunkModuleResponseDto>
                for (const item of records) {
                    const current = statistics.get(`${item.module}:${item.type}`)
                    if (!current) {
                        item.chunkCount = 0
                    } else {
                        item.chunkCount = current.count
                        item.modifyBy = current.latest.modifyBy
                        item.modifyTime = current.latest.modifyTime
                    }
                }
                return await feign.appendSkylineUserOptions(this.skylineFeignClient, this.configService, records, ['createBy', 'modifyBy'])
            })
        })
    }

    /** 通过 Skyline 账号 Feign 批量把枚举项的 createBy、modifyBy 还原为 createByOptions、modifyByOptions。 */
    public async appendChunkOperators(list: Array<Schema.TbSkylineChunk>): Promise<Array<ChunkDto.ChunkColumnResponseDto>> {
        return await feign.appendSkylineUserOptions(this.skylineFeignClient, this.configService, list, ['createBy', 'modifyBy'])
    }

    /**
     * 把扁平枚举项按 pid 组装成选项树。
     * pid 为空或指向集合外节点的枚举项都作为根节点返回，避免单个枚举项父级被禁用时整组选项丢失。
     */
    public buildOptionTree(entities: Schema.TbSkylineChunk[]): feign.SkylineChunkOption[] {
        return utils.fromTreeList(
            entities.map(entity => this.toOption(entity)),
            { id: 'keyId' }
        )
    }

    /**
     * 把扁平枚举项按 pid 组装成父级选择树。
     * excludeKeyId 对应编辑中的枚举项，自身及其子孙节点不会返回，避免把父级设置成自身或子孙节点形成循环。
     */
    public buildTree(entities: Schema.TbSkylineChunk[], excludeKeyId?: number): ChunkDto.ChunkTreeNodeResponseDto[] {
        const tree = utils.fromTreeList<ChunkDto.ChunkTreeNodeResponseDto>(
            entities.map(({ keyId, pid, module, type, name, value, sort, status }) => {
                return { keyId, pid, module, type, name, value, sort, status, children: [] }
            }),
            { id: 'keyId' }
        )
        if (utils.isNotEmpty(excludeKeyId)) {
            utils.removeTreeNode(tree, node => node.keyId === excludeKeyId)
        }
        return tree
    }

    /**
     * 把枚举项组装成列表树，子节点字段为 items。
     *
     * filter 存在时保留命中节点及其祖先节点；rootPid 为空时返回一级节点，否则返回 rootPid 的直接下级。
     */
    public buildColumnTree(
        entities: Schema.TbSkylineChunk[],
        filter?: (node: ChunkDto.ChunkColumnResponseDto) => boolean,
        rootPid?: number | null
    ): ChunkDto.ChunkColumnResponseDto[] {
        const config = { id: 'keyId', children: 'items' }
        const tree = utils.fromTreeList<ChunkDto.ChunkColumnResponseDto>(entities, config)
        const filtered = filter ? utils.filterTree(tree, filter, config) : tree
        return utils.isEmpty(rootPid) ? filtered : (utils.findTreeNode(filtered, node => node.keyId === rootPid, config)?.items ?? [])
    }

    /** 为列表树中的所有节点补充创建人、更新人选项。 */
    public async appendChunkTreeOperators(list: ChunkDto.ChunkColumnResponseDto[]): Promise<ChunkDto.ChunkColumnResponseDto[]> {
        await this.appendChunkOperators(utils.toTreeList(list, { children: 'items' }))
        return list
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
    public async assertModuleType(module: Schema.TbSkylineChunkModule, type: Schema.TbSkylineChunkModuleType): Promise<void> {
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
        if (utils.isEmpty(pid)) {
            return
        }
        if (utils.isNotEmpty(keyId) && pid === keyId) {
            throw new BadRequestException('枚举项不能将自身设置为父节点')
        }
        const parent = await this.repository.findOne({ where: { keyId: pid } })
        if (!parent) {
            throw new NotFoundException('父枚举项不存在')
        }
        if (utils.isNotEmpty(module) && parent.module !== module) {
            throw new BadRequestException('父枚举项必须属于同一模块')
        }
    }

    /** 同一模块、同一类型下的业务值必须唯一。 */
    public async assertUnique(
        module: Schema.TbSkylineChunkModule,
        type: Schema.TbSkylineChunkModuleType,
        value: string,
        excludeKeyId?: number
    ): Promise<void> {
        const where: Record<string, unknown> = { module, type, value }
        if (utils.isNotEmpty(excludeKeyId)) {
            where.keyId = Not(excludeKeyId)
        }
        const existing = await this.repository.findOne({ where })
        if (existing) {
            throw new BadRequestException('同一模块下该类型的业务值已存在')
        }
    }
}
