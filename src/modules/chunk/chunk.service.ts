import { InjectRepository, DataBaseService, In, Repository } from '@wlisfes/chat-web-base-schema/database'
import { v4, PageResult, isNotEmpty, fetchResolver, fetchUntiePagination } from '@wlisfes/chat-web-base-schema/utils'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { ChunkUtilsService } from '@/modules/chunk/chunk.utils.service'
import * as feign from '@wlisfes/chat-web-base-schema/feign'
import * as ChunkDto from '@/modules/chunk/dto/chunk.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'

/** Skyline 枚举字典 CRUD 业务服务。 */
@Injectable()
export class ChunkService {
    constructor(
        @InjectRepository(Schema.TbSkylineChunk) private readonly repository: Repository<Schema.TbSkylineChunk>,
        @InjectRepository(Schema.TbSkylineChunkModuleEntity)
        private readonly moduleRepository: Repository<Schema.TbSkylineChunkModuleEntity>,
        private readonly database: DataBaseService,
        private readonly chunkUtilsService: ChunkUtilsService
    ) {}

    /** 枚举字典静态枚举。 */
    public async httpBaseSkylineChunkEnums(): Promise<ChunkDto.ChunkEnumsResponseDto> {
        return {
            moduleOptions: Schema.TbSkylineChunkModuleDefinition.options,
            kindOptions: Schema.TbSkylineChunkModuleKindDefinition.options,
            statusOptions: Schema.TbSkylineChunkStatusDefinition.options
        }
    }

    /** 按 module + type 获取枚举字典树；传入 keyId 时排除自身及其子孙节点，用于选择父级主键。 */
    public async httpBaseSkylineChunkTreeStructure(query: ChunkDto.ChunkTreeQueryDto): Promise<ChunkDto.ChunkTreeNodeResponseDto[]> {
        await this.chunkUtilsService.assertModuleType(query.module, query.type)
        const entities = await this.repository.find({
            select: ['keyId', 'pid', 'module', 'type', 'name', 'value', 'sort', 'status'],
            where: { module: query.module, type: query.type },
            order: { sort: 'ASC', keyId: 'ASC' }
        })
        return this.chunkUtilsService.buildTree(entities, query.keyId)
    }

    /** 分页查询枚举字典；同级按排序号倒序、主键升序，结果保持扁平结构，通过 pid 表示父子关系，并补充创建人、更新人选项。 */
    public async httpBaseSkylineColumnChunk(input: ChunkDto.ListChunkDto): Promise<PageResult<ChunkDto.ChunkColumnResponseDto>> {
        const { page, size } = fetchUntiePagination(input)
        if (isNotEmpty(input.module) && isNotEmpty(input.type)) {
            const chunkModule = await this.moduleRepository.findOne({ where: { module: input.module, type: input.type } })
            if (chunkModule?.kind === Schema.TbSkylineChunkModuleKind.TREE) {
                return this.httpBaseSkylineColumnChunkTree(input, page, size)
            }
        }
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
            qb.addOrderBy('t.sort', 'DESC')
            qb.addOrderBy('t.keyId', 'ASC')
            qb.skip((page - 1) * size)
            qb.take(size)
            return await qb.getManyAndCount().then(async ([list, total]) => {
                return fetchResolver({ page, size, total, list: await this.chunkUtilsService.appendChunkOperators(list) })
            })
        })
    }

    /**
     * 树形枚举分类的分页列表：按一级节点分页，下级节点挂在 children 中返回。
     *
     * 存在名称、状态筛选时保留命中节点及其祖先节点，保证命中的下级节点仍能展示完整层级；
     * 传入 pid 时以该节点的直接下级作为分页根节点。
     */
    private async httpBaseSkylineColumnChunkTree(
        input: ChunkDto.ListChunkDto,
        page: number,
        size: number
    ): Promise<PageResult<ChunkDto.ChunkColumnResponseDto>> {
        // 各层级同级节点按排序号升序，排序号相同时按主键升序；组树时保持查询顺序。
        const entities = await this.repository.find({
            where: { module: input.module, type: input.type },
            order: { sort: 'ASC', keyId: 'ASC' }
        })
        const name = input.name?.trim()
        const filter =
            isNotEmpty(name) || isNotEmpty(input.status)
                ? (node: ChunkDto.ChunkColumnResponseDto) => {
                      return (!isNotEmpty(name) || node.name.includes(name)) && (!isNotEmpty(input.status) || node.status === input.status)
                  }
                : undefined
        const tree = this.chunkUtilsService.buildColumnTree(entities, filter, input.pid)
        const list = tree.slice((page - 1) * size, page * size)
        return fetchResolver({ page, size, total: tree.length, list: await this.chunkUtilsService.appendChunkTreeOperators(list) })
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
                return fetchResolver({ page, size, total, list: await this.chunkUtilsService.appendChunkStatistics(list) })
            })
        })
    }

    /** 查询枚举字典详情。 */
    public async httpBaseSkylineChunkResolver(query: ChunkDto.ChunkKeyDto): Promise<ChunkDto.ChunkResponseDto> {
        return this.chunkUtilsService.findRequired(query.keyId)
    }

    /** 新增枚举字典项；业务值为空时使用新增后的主键，创建人、更新人取当前登录账号。 */
    public async httpBaseSkylineCreateChunk(principal: AuthPrincipal, input: ChunkDto.CreateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        const value = input.value?.trim()
        await this.chunkUtilsService.assertModuleType(input.module, input.type)
        await this.chunkUtilsService.assertParent(input.pid, input.module)
        if (isNotEmpty(value)) {
            await this.chunkUtilsService.assertUnique(input.module, input.type, value)
        }
        const keyId = await this.repository.manager.transaction(async manager => {
            // 业务值为空时先写入唯一占位值，拿到自增主键后在同一事务内回填为主键。
            // WithJsonColumn 会把 undefined 转成 NULL 写入，无法落到数据库 DEFAULT，未传 json 时显式写入空对象。
            const entity = manager.create(Schema.TbSkylineChunk, {
                ...input,
                value: value || `__pending_${v4()}`,
                json: input.json ?? {},
                createBy: principal.uid,
                modifyBy: principal.uid
            } as Schema.TbSkylineChunk)
            const node = await manager.save(entity)
            if (!value) {
                const nextValue = String(node.keyId)
                const existing = await manager.findOne(Schema.TbSkylineChunk, {
                    where: { module: input.module, type: input.type, value: nextValue }
                })
                if (existing) {
                    throw new BadRequestException('同一模块下该类型的业务值已存在')
                }
                await manager.update(Schema.TbSkylineChunk, node.keyId, { value: nextValue })
            }
            return node.keyId
        })
        return await this.chunkUtilsService.findRequired(keyId)
    }

    /** 更新枚举字典项；不允许更新的枚举项仅超级管理员可修改，更新人取当前登录账号。 */
    public async httpBaseSkylineUpdateChunk(principal: AuthPrincipal, input: ChunkDto.UpdateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        const current = await this.chunkUtilsService.findRequired(input.keyId)
        if (!current.allowUpdate && principal.superAdmin !== true) {
            throw new BadRequestException('当前枚举项不允许更新')
        }
        const module = input.module ?? current.module
        const type = input.type ?? current.type
        const value = input.value === '' ? String(input.keyId) : (input.value ?? current.value)
        await this.chunkUtilsService.assertModuleType(module, type)
        await this.chunkUtilsService.assertParent(input.pid, module, input.keyId)
        await this.chunkUtilsService.assertUnique(module, type, value, input.keyId)
        const { keyId, ...changes } = input
        return await this.repository
            .update(keyId, { ...changes, ...(input.value === undefined ? {} : { value }), modifyBy: principal.uid } as never)
            .then(async () => {
                return await this.chunkUtilsService.findRequired(keyId)
            })
    }

    /** 硬删除枚举字典项；存在子项时必须先处理子项。 */
    public async httpBaseSkylineDeleteChunk(
        principal: AuthPrincipal,
        input: ChunkDto.ChunkKeyDto
    ): Promise<ChunkDto.DeleteChunkResponseDto> {
        const current = await this.chunkUtilsService.findRequired(input.keyId)
        if (!current.allowDelete && principal.superAdmin !== true) {
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
    public async httpBaseSkylineChunkOptionColumn(input: feign.SkylineColumnChunkOptionInput): Promise<feign.SkylineChunkOptionRecord> {
        const types = Array.from(new Set(input.types))
        const where: Record<string, unknown> = { type: In(types), status: Schema.TbSkylineChunkStatus.CHUNK_ENABLE }
        if (isNotEmpty(input.module)) {
            where.module = input.module
        }
        return await this.repository.find({ where, order: { type: 'ASC', sort: 'ASC', keyId: 'ASC' } }).then(entities => {
            // 以请求的类型编码为 key 返回分组，缺失的类型返回空选项，调用方无需再做存在性判断。
            return Object.fromEntries(
                types.map(type => {
                    const options = this.chunkUtilsService.buildOptionTree(entities.filter(entity => entity.type === type))
                    return [type, { type, count: options.length, options }]
                })
            )
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
        const options = this.chunkUtilsService.buildOptionTree(children)
        // 无下级时不返回 children 字段，与批量选项接口的叶子节点保持一致。
        return {
            ...this.chunkUtilsService.toOption(entity),
            ...(options.length > 0 ? { children: options } : {})
        }
    }
}
