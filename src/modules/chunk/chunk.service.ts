import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import * as ChunkDto from '@/modules/chunk/dto/chunk.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'
import { InjectRepository, DataBaseService, In, Not, Repository } from '@wlisfes/chat-web-base-schema/database'
import { PageResult, isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
import {
    SkylineColumnChunkOptionInput,
    SkylineChunkOption,
    SkylineChunkOptionGroup,
    SkylineChunkOptionResolverInput
} from '@wlisfes/chat-web-base-schema/feign'

/** Skyline 枚举字典 CRUD 业务服务。 */
@Injectable()
export class ChunkService {
    constructor(
        @InjectRepository(Schema.TbSkylineChunk) private readonly repository: Repository<Schema.TbSkylineChunk>,
        private readonly database: DataBaseService
    ) {}

    /** 枚举字典静态枚举。 */
    public async httpBaseSkylineChunkEnums(): Promise<ChunkDto.ChunkEnumsResponseDto> {
        return {
            moduleOptions: Schema.TbSkylineChunkModuleDefinition.options,
            statusOptions: Schema.TbSkylineChunkStatusDefinition.options
        }
    }

    /** 分页查询枚举字典；结果保持扁平结构，通过 pid 表示父子关系。 */
    public async httpBaseSkylineColumnChunk(input: ChunkDto.ListChunkDto): Promise<PageResult<ChunkDto.ChunkResponseDto>> {
        const page = input.page ?? 1
        const size = input.size ?? 50
        return this.database.builder(this.repository, async qb => {
            if (isNotEmpty(input.module)) qb.andWhere('t.module = :module', { module: input.module })
            if (isNotEmpty(input.type)) qb.andWhere('t.type = :type', { type: input.type })
            const name = input.name?.trim()
            if (isNotEmpty(name)) qb.andWhere('t.name LIKE :name', { name: `%${name}%` })
            if (isNotEmpty(input.status)) qb.andWhere('t.status = :status', { status: input.status })
            if (input.pid !== undefined) qb.andWhere('t.pid = :pid', { pid: input.pid })
            qb.orderBy('t.module', 'ASC')
                .addOrderBy('t.type', 'ASC')
                .addOrderBy('t.pid', 'ASC')
                .addOrderBy('t.sort', 'ASC')
                .addOrderBy('t.keyId', 'ASC')
                .skip((page - 1) * size)
                .take(size)
            const [list, total] = await qb.getManyAndCount()
            return { page, size, total, list: list.map(entity => this.toResponse(entity)) }
        })
    }

    /** 查询枚举字典详情。 */
    public async httpBaseSkylineResolverChunk(query: ChunkDto.ChunkKeyDto): Promise<ChunkDto.ChunkResponseDto> {
        return this.toResponse(await this.findRequired(query.keyId))
    }

    /** 新增枚举字典项。 */
    public async httpBaseSkylineCreateChunk(input: ChunkDto.CreateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        await this.assertParent(input.pid, input.module)
        await this.assertUnique(input.module, input.type, input.value)
        const entity = this.repository.create({
            ...input,
            json: this.normalizeJson(input.json)
        } as Schema.TbSkylineChunk)
        return this.toResponse(await this.repository.save(entity))
    }

    /** 更新枚举字典项。 */
    public async httpBaseSkylineUpdateChunk(input: ChunkDto.UpdateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        const current = await this.findRequired(input.keyId)
        if (!current.allowUpdate) throw new BadRequestException('当前枚举项不允许更新')
        const module = input.module ?? current.module
        const type = input.type ?? current.type
        const value = input.value ?? current.value
        await this.assertParent(input.pid, module, input.keyId)
        await this.assertUnique(module, type, value, input.keyId)
        const { keyId, ...changes } = input
        if ('json' in changes) changes.json = this.normalizeJson(changes.json)
        await this.repository.update(keyId, changes as never)
        return this.toResponse(await this.findRequired(keyId))
    }

    /** 硬删除枚举字典项；存在子项时必须先处理子项。 */
    public async httpBaseSkylineDeleteChunk(input: ChunkDto.ChunkKeyDto): Promise<ChunkDto.DeleteChunkResponseDto> {
        const current = await this.findRequired(input.keyId)
        if (!current.allowDelete) throw new BadRequestException('当前枚举项不允许删除')
        const children = await this.repository.count({ where: { pid: input.keyId } })
        if (children > 0) throw new BadRequestException('存在子枚举项时不能删除父枚举项')
        await this.repository.delete(input.keyId)
        return { success: true }
    }

    /** 供内部服务按枚举类型编码批量获取启用状态的枚举字典选项，结果按类型分组并组装成选项树。 */
    public async httpBaseSkylineColumnChunkOption(input: SkylineColumnChunkOptionInput): Promise<SkylineChunkOptionGroup[]> {
        const types = Array.from(new Set(input.types))
        const where: Record<string, unknown> = { type: In(types), status: Schema.TbSkylineChunkStatus.CHUNK_ENABLE }
        if (isNotEmpty(input.module)) where.module = input.module
        const entities = await this.repository.find({ where, order: { type: 'ASC', sort: 'ASC', keyId: 'ASC' } })

        // 按请求顺序返回分组，缺失的类型返回空选项，调用方无需再做存在性判断。
        return types.map(type => {
            const options = this.buildOptionTree(entities.filter(entity => entity.type === type))
            return { type, count: options.length, options }
        })
    }

    /** 供内部服务按枚举业务值解析单个启用状态的枚举字典选项。 */
    public async httpBaseSkylineChunkOptionResolver(input: SkylineChunkOptionResolverInput): Promise<SkylineChunkOption> {
        const where: Record<string, unknown> = {
            type: input.type,
            value: input.value,
            status: Schema.TbSkylineChunkStatus.CHUNK_ENABLE
        }
        if (isNotEmpty(input.module)) where.module = input.module
        const entity = await this.repository.findOne({ where })
        if (!entity) throw new NotFoundException('枚举项不存在或已禁用')

        const children = await this.repository.find({
            where: { pid: entity.keyId, status: Schema.TbSkylineChunkStatus.CHUNK_ENABLE },
            order: { sort: 'ASC', keyId: 'ASC' }
        })
        return { ...this.toOption(entity), children: this.buildOptionTree(children, entity.keyId) }
    }

    /**
     * 把扁平枚举项按 pid 组装成选项树。
     *
     * rootPid 表示本次组装的根节点父级，pid 等于它、为空或指向集合外节点的枚举项都作为根节点返回，
     * 避免单个枚举项父级被禁用时整组选项丢失。
     */
    private buildOptionTree(entities: Schema.TbSkylineChunk[], rootPid?: number): SkylineChunkOption[] {
        const options = new Map<number, SkylineChunkOption>()
        for (const entity of entities) {
            options.set(entity.keyId, this.toOption(entity))
        }

        const roots: SkylineChunkOption[] = []
        for (const entity of entities) {
            const option = options.get(entity.keyId) as SkylineChunkOption
            const parent = isNotEmpty(entity.pid) && entity.pid !== rootPid ? options.get(entity.pid) : undefined
            if (parent) parent.children.push(option)
            else roots.push(option)
        }

        return roots
    }

    /** 把枚举实体转换为统一的下拉选项结构；description 取自扩展配置，缺省时回落为显示名称。 */
    private toOption(entity: Schema.TbSkylineChunk): SkylineChunkOption {
        const json = this.normalizeJson(entity.json)
        const description = json.description
        return {
            value: entity.value,
            label: entity.name,
            description: typeof description === 'string' ? description : entity.name,
            keyId: entity.keyId,
            pid: entity.pid,
            sort: entity.sort,
            json,
            children: []
        }
    }

    /** 扩展配置缺省为空对象，并去掉职位迁移残留的 legacyKeyId。 */
    private normalizeJson(json?: Record<string, unknown> | null): Record<string, unknown> {
        const next = { ...(json ?? {}) }
        delete next.legacyKeyId
        return next
    }

    /** 对外返回时统一规范化 json，避免接口带出空值或迁移残留字段。 */
    private toResponse(entity: Schema.TbSkylineChunk): ChunkDto.ChunkResponseDto {
        return {
            ...(entity as unknown as ChunkDto.ChunkResponseDto),
            json: this.normalizeJson(entity.json)
        }
    }

    private async findRequired(keyId: number): Promise<Schema.TbSkylineChunk> {
        const entity = await this.repository.findOne({ where: { keyId } })
        if (!entity) throw new NotFoundException('枚举项不存在')
        return entity
    }

    /** 校验父枚举项存在、不能指向自身，且必须属于同一模块。 */
    private async assertParent(pid?: number | null, module?: Schema.TbSkylineChunkModule, keyId?: number): Promise<void> {
        if (pid === undefined || pid === null) return
        if (keyId !== undefined && pid === keyId) throw new BadRequestException('枚举项不能将自身设置为父节点')
        const parent = await this.repository.findOne({ where: { keyId: pid } })
        if (!parent) throw new NotFoundException('父枚举项不存在')
        if (module && parent.module !== module) throw new BadRequestException('父枚举项必须属于同一模块')
    }

    /** 同一模块、同一类型下的业务值必须唯一。 */
    private async assertUnique(module: Schema.TbSkylineChunkModule, type: string, value: string, excludeKeyId?: number): Promise<void> {
        const where: Record<string, unknown> = { module, type, value }
        if (excludeKeyId) where.keyId = Not(excludeKeyId)
        const existing = await this.repository.findOne({ where })
        if (existing) throw new BadRequestException('同一模块下该类型的业务值已存在')
    }
}
