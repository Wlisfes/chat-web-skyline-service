import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataBaseService } from '@wlisfes/chat-web-base-schema/database'
import { PageResult } from '@wlisfes/chat-web-base-schema/utils'
import { isNotEmpty } from 'class-validator'
import { Repository } from 'typeorm'
import { TbSkylineChunk, TbSkylineChunkStatus } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import * as ChunkDto from '@/modules/chunk/dto/chunk.dto'

/** Skyline 枚举字典 CRUD 业务服务。 */
@Injectable()
export class ChunkService {
    constructor(
        @InjectRepository(TbSkylineChunk) private readonly repository: Repository<TbSkylineChunk>,
        private readonly database: DataBaseService
    ) {}

    /** 分页查询枚举字典；结果保持扁平结构，通过 pid 表示父子关系。 */
    public async httpBaseSkylineColumnChunk(input: ChunkDto.ListChunkDto): Promise<PageResult<ChunkDto.ChunkResponseDto>> {
        const page = input.page ?? 1
        const size = input.size ?? 50
        return this.database.builder(this.repository, async qb => {
            if (isNotEmpty(input.type)) qb.andWhere('t.type = :type', { type: input.type })
            if (isNotEmpty(input.status)) qb.andWhere('t.status = :status', { status: input.status })
            if (input.pid !== undefined) qb.andWhere('t.pid = :pid', { pid: input.pid })
            qb.orderBy('t.type', 'ASC')
                .addOrderBy('t.pid', 'ASC')
                .addOrderBy('t.sort', 'ASC')
                .addOrderBy('t.keyId', 'ASC')
                .skip((page - 1) * size)
                .take(size)
            const [list, total] = await qb.getManyAndCount()
            return { page, size, total, list: list as unknown as ChunkDto.ChunkResponseDto[] }
        })
    }

    /** 查询枚举字典详情。 */
    public async httpBaseSkylineResolverChunk(query: ChunkDto.ChunkKeyDto): Promise<ChunkDto.ChunkResponseDto> {
        return (await this.findRequired(query.keyId)) as unknown as ChunkDto.ChunkResponseDto
    }

    /** 新增枚举字典项。 */
    public async httpBaseSkylineCreateChunk(input: ChunkDto.CreateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        await this.assertParent(input.pid)
        const entity = this.repository.create(input as TbSkylineChunk)
        return (await this.repository.save(entity)) as unknown as ChunkDto.ChunkResponseDto
    }

    /** 更新枚举字典项。 */
    public async httpBaseSkylineUpdateChunk(input: ChunkDto.UpdateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        const current = await this.findRequired(input.keyId)
        if (!current.allowUpdate) throw new BadRequestException('当前枚举项不允许更新')
        if (input.pid === input.keyId) throw new BadRequestException('枚举项不能将自身设置为父节点')
        await this.assertParent(input.pid)
        const { keyId, ...changes } = input
        await this.repository.update(keyId, changes as never)
        return (await this.findRequired(keyId)) as unknown as ChunkDto.ChunkResponseDto
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

    private async findRequired(keyId: number): Promise<TbSkylineChunk> {
        const entity = await this.repository.findOne({ where: { keyId } })
        if (!entity) throw new NotFoundException('枚举项不存在')
        return entity
    }

    private async assertParent(pid: number | undefined): Promise<void> {
        if (pid === undefined || pid === null) return
        await this.findRequired(pid)
    }
}
