import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { InjectRepository, DataBaseService, In, Repository } from '@wlisfes/chat-web-base-schema/database'
import { PageResult, isNotEmpty, fetchResolver, fetchUntiePagination } from '@wlisfes/chat-web-base-schema/utils'
import { ChunkUtilsService } from '@/modules/chunk/chunk.utils.service'
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
                return fetchResolver({ page, size, total, list: await this.chunkUtilsService.appendChunkStatistics(list) })
            })
        })
    }

    /** 查询枚举字典详情。 */
    public async httpBaseSkylineResolverChunk(query: ChunkDto.ChunkKeyDto): Promise<ChunkDto.ChunkResponseDto> {
        return this.chunkUtilsService.findRequired(query.keyId)
    }

    /** 新增枚举字典项；创建人、更新人取当前登录账号。 */
    public async httpBaseSkylineCreateChunk(principal: AuthPrincipal, input: ChunkDto.CreateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        await this.chunkUtilsService.assertModuleType(input.module, input.type)
        await this.chunkUtilsService.assertParent(input.pid, input.module)
        await this.chunkUtilsService.assertUnique(input.module, input.type, input.value)
        // WithJsonColumn 会把 undefined 转成 NULL 写入，无法落到数据库 DEFAULT，未传 json 时显式写入空对象。
        const entity = this.repository.create({
            ...input,
            json: input.json ?? {},
            createBy: principal.uid,
            modifyBy: principal.uid
        } as Schema.TbSkylineChunk)
        return await this.repository.save(entity).then(async node => {
            return await this.chunkUtilsService.findRequired(node.keyId)
        })
    }

    /** 更新枚举字典项；更新人取当前登录账号。 */
    public async httpBaseSkylineUpdateChunk(principal: AuthPrincipal, input: ChunkDto.UpdateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        const current = await this.chunkUtilsService.findRequired(input.keyId)
        if (!current.allowUpdate) {
            throw new BadRequestException('当前枚举项不允许更新')
        }
        const module = input.module ?? current.module
        const type = input.type ?? current.type
        const value = input.value ?? current.value
        await this.chunkUtilsService.assertModuleType(module, type)
        await this.chunkUtilsService.assertParent(input.pid, module, input.keyId)
        await this.chunkUtilsService.assertUnique(module, type, value, input.keyId)
        const { keyId, ...changes } = input
        return await this.repository.update(keyId, { ...changes, modifyBy: principal.uid } as never).then(async () => {
            return await this.chunkUtilsService.findRequired(keyId)
        })
    }

    /** 硬删除枚举字典项；存在子项时必须先处理子项。 */
    public async httpBaseSkylineDeleteChunk(input: ChunkDto.ChunkKeyDto): Promise<ChunkDto.DeleteChunkResponseDto> {
        const current = await this.chunkUtilsService.findRequired(input.keyId)
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
                const options = this.chunkUtilsService.buildOptionTree(entities.filter(entity => entity.type === type))
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
        return { ...this.chunkUtilsService.toOption(entity), children: this.chunkUtilsService.buildOptionTree(children, entity.keyId) }
    }
}
