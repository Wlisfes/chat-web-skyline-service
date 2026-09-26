import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository, DataBaseService, In, Not, Repository } from '@wlisfes/chat-web-base-schema/database'
import { PageResult, isEmpty, isNotEmpty, fetchResolver, fetchUntiePagination } from '@wlisfes/chat-web-base-schema/utils'
import * as ChunkDto from '@/modules/chunk/dto/chunk.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'
import * as feign from '@wlisfes/chat-web-base-schema/feign'

/** Skyline 枚举字典 CRUD 业务服务。 */
@Injectable()
export class ChunkService {
    constructor(
        @InjectRepository(Schema.TbSkylineChunk) private readonly repository: Repository<Schema.TbSkylineChunk>,
        @InjectRepository(Schema.TbSkylineChunkModuleEntity)
        private readonly moduleRepository: Repository<Schema.TbSkylineChunkModuleEntity>,
        private readonly database: DataBaseService
    ) {}

    /** 枚举字典静态枚举。 */
    public async httpBaseSkylineChunkEnums(): Promise<ChunkDto.ChunkEnumsResponseDto> {
        return {
            moduleOptions: Schema.TbSkylineChunkModuleDefinition.options,
            kindOptions: Schema.TbSkylineChunkModuleKindDefinition.options,
            statusOptions: Schema.TbSkylineChunkStatusDefinition.options
        }
    }

    /** 分页查询枚举字典；结果保持扁平结构，通过 pid 表示父子关系。 */
    public async httpBaseSkylineColumnChunk(input: ChunkDto.ListChunkDto): Promise<PageResult<ChunkDto.ChunkResponseDto>> {
        const { page, size } = fetchUntiePagination(input)
        return this.database.builder(this.repository, async qb => {
            if (isNotEmpty(input.module)) {
                qb.andWhere('t.module = :module', { module: input.module })
            }
            if (isNotEmpty(input.type)) {
                qb.andWhere('t.type = :type', { type: input.type })
            }
            if (isNotEmpty(input.name?.trim())) {
                qb.andWhere('t.name LIKE :name', { name: `%${input.name?.trim()}%` })
            }
            if (isNotEmpty(input.status)) {
                qb.andWhere('t.status = :status', { status: input.status })
            }
            if (isNotEmpty(input.pid)) {
                qb.andWhere('t.pid = :pid', { pid: input.pid })
            }
            qb.orderBy('t.module', 'ASC')
            qb.addOrderBy('t.type', 'ASC')
            qb.addOrderBy('t.pid', 'ASC')
            qb.addOrderBy('t.sort', 'ASC')
            qb.addOrderBy('t.keyId', 'ASC')
            qb.skip((page - 1) * size)
            qb.take(size)
            return await qb.getManyAndCount().then(async ([list, total]) => {
                return fetchResolver({ page, size, total, list })
            })
        })
    }

    /** 分页查询枚举分类；分类数据由 SQL 维护，接口不提供增删改。 */
    public async httpBaseSkylineColumnChunkModule(
        input: ChunkDto.ListChunkModuleDto
    ): Promise<PageResult<ChunkDto.ChunkModuleResponseDto>> {
        const { page, size } = fetchUntiePagination(input)
        return this.database.builder(this.moduleRepository, async qb => {
            if (isNotEmpty(input.module)) {
                qb.andWhere('t.module = :module', { module: input.module })
            }
            if (isNotEmpty(input.kind)) {
                qb.andWhere('t.kind = :kind', { kind: input.kind })
            }
            if (isNotEmpty(input.name?.trim())) {
                qb.andWhere('t.name LIKE :name', { name: `%${input.name?.trim()}%` })
            }
            qb.orderBy('t.keyId', 'ASC')
            qb.skip((page - 1) * size)
            qb.take(size)
            return await qb.getManyAndCount().then(async ([list, total]) => {
                return fetchResolver({ page, size, total, list: await this.appendChunkCount(list) })
            })
        })
    }

    /** 按 module + type 联查子表 tb_skyline_chunk，为当前页枚举分类补充枚举项数量。 */
    private async appendChunkCount(list: Array<Schema.TbSkylineChunkModuleEntity>): Promise<Array<ChunkDto.ChunkModuleResponseDto>> {
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

    /** 查询枚举字典详情。 */
    public async httpBaseSkylineResolverChunk(query: ChunkDto.ChunkKeyDto): Promise<ChunkDto.ChunkResponseDto> {
        return this.findRequired(query.keyId)
    }

    /** 新增枚举字典项。 */
    public async httpBaseSkylineCreateChunk(input: ChunkDto.CreateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        await this.assertModuleType(input.module, input.type)
        await this.assertParent(input.pid, input.module)
        await this.assertUnique(input.module, input.type, input.value)
        // WithJsonColumn 会把 undefined 转成 NULL 写入，无法落到数据库 DEFAULT，未传 json 时显式写入空对象。
        const entity = this.repository.create({ ...input, json: input.json ?? {} } as Schema.TbSkylineChunk)
        return await this.repository.save(entity).then(async node => {
            return await this.findRequired(node.keyId)
        })
    }

    /** 更新枚举字典项。 */
    public async httpBaseSkylineUpdateChunk(input: ChunkDto.UpdateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        const current = await this.findRequired(input.keyId)
        if (!current.allowUpdate) {
            throw new BadRequestException('当前枚举项不允许更新')
        }
        const module = input.module ?? current.module
        const type = input.type ?? current.type
        const value = input.value ?? current.value
        await this.assertModuleType(module, type)
        await this.assertParent(input.pid, module, input.keyId)
        await this.assertUnique(module, type, value, input.keyId)
        const { keyId, ...changes } = input
        return await this.repository.update(keyId, changes as never).then(async () => {
            return await this.findRequired(keyId)
        })
    }

    /** 硬删除枚举字典项；存在子项时必须先处理子项。 */
    public async httpBaseSkylineDeleteChunk(input: ChunkDto.ChunkKeyDto): Promise<ChunkDto.DeleteChunkResponseDto> {
        const current = await this.findRequired(input.keyId)
        if (!current.allowDelete) {
            throw new BadRequestException('当前枚举项不允许删除')
        }
        const children = await this.repository.count({ where: { pid: input.keyId } })
        if (children > 0) {
            throw new BadRequestException('存在子枚举项时不能删除父枚举项')
        }
        return await this.repository.delete(input.keyId).then(() => {
            return { success: true }
        })
    }

    /** 供内部服务按枚举类型编码批量获取启用状态的枚举字典选项，结果按类型分组并组装成选项树。 */
    public async httpBaseSkylineColumnChunkOption(input: feign.SkylineColumnChunkOptionInput): Promise<feign.SkylineChunkOptionGroup[]> {
        const types = Array.from(new Set(input.types))
        const where: Record<string, unknown> = { type: In(types), status: Schema.TbSkylineChunkStatus.CHUNK_ENABLE }
        if (isNotEmpty(input.module)) {
            where.module = input.module
        }
        return await this.repository.find({ where, order: { type: 'ASC', sort: 'ASC', keyId: 'ASC' } }).then(entities => {
            // 按请求顺序返回分组，缺失的类型返回空选项，调用方无需再做存在性判断。
            return types.map(type => {
                const options = this.buildOptionTree(entities.filter(entity => entity.type === type))
                return { type, count: options.length, options }
            })
        })
    }

    /** 供内部服务按枚举业务值解析单个启用状态的枚举字典选项。 */
    public async httpBaseSkylineChunkOptionResolver(input: feign.SkylineChunkOptionResolverInput): Promise<feign.SkylineChunkOption> {
        const where: Record<string, unknown> = {
            type: input.type,
            value: input.value,
            status: Schema.TbSkylineChunkStatus.CHUNK_ENABLE
        }
        if (isNotEmpty(input.module)) {
            where.module = input.module
        }
        const entity = await this.repository.findOne({ where })
        if (!entity) {
            throw new NotFoundException('枚举项不存在或已禁用')
        }
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
    private buildOptionTree(entities: Schema.TbSkylineChunk[], rootPid?: number): feign.SkylineChunkOption[] {
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
    private toOption(entity: Schema.TbSkylineChunk): feign.SkylineChunkOption {
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
    private async assertModuleType(module: Schema.TbSkylineChunkModule, type: string): Promise<void> {
        const found = await this.moduleRepository.findOne({ where: { module, type } })
        if (!found) {
            throw new BadRequestException('枚举分类不存在')
        }
    }

    /** 按主键查询枚举项，不存在时抛出异常。 */
    private async findRequired(keyId: number): Promise<Schema.TbSkylineChunk> {
        const entity = await this.repository.findOne({ where: { keyId } })
        if (!entity) {
            throw new NotFoundException('枚举项不存在')
        }
        return entity
    }

    /** 校验父枚举项存在、不能指向自身，且必须属于同一模块。 */
    private async assertParent(pid?: number | null, module?: Schema.TbSkylineChunkModule, keyId?: number): Promise<void> {
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
    private async assertUnique(module: Schema.TbSkylineChunkModule, type: string, value: string, excludeKeyId?: number): Promise<void> {
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
