import { Body, Get, Post, Query } from '@nestjs/common'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { ChunkService } from '@/modules/chunk/chunk.service'
import * as ChunkDto from '@/modules/chunk/dto/chunk.dto'

/** Skyline 枚举字典管理接口。 */
@ApifoxController('Skyline 枚举字典管理', 'deploy/chunk', { bearerAuth: true })
export class ChunkController {
    constructor(private readonly chunkService: ChunkService) {}

    @ApiServiceDecorator(Post('column'), {
        operation: { summary: '枚举字典分页列表' },
        request: { source: 'body', type: ChunkDto.ListChunkDto },
        response: { type: ChunkDto.ChunkPageResponseDto, description: '枚举字典分页数据' },
        bearerAuth: true
    })
    public async httpBaseSkylineColumnChunk(@Body() input: ChunkDto.ListChunkDto): Promise<ChunkDto.ChunkPageResponseDto> {
        return this.chunkService.httpBaseSkylineColumnChunk(input)
    }

    @ApiServiceDecorator(Get('resolver'), {
        operation: { summary: '枚举字典详情' },
        request: { source: 'query', type: ChunkDto.ChunkKeyDto },
        response: { type: ChunkDto.ChunkResponseDto, description: '枚举字典详情' },
        bearerAuth: true
    })
    public async httpBaseSkylineResolverChunk(@Query() query: ChunkDto.ChunkKeyDto): Promise<ChunkDto.ChunkResponseDto> {
        return this.chunkService.httpBaseSkylineResolverChunk(query)
    }

    @ApiServiceDecorator(Post('create'), {
        operation: { summary: '新增枚举字典项' },
        request: { source: 'body', type: ChunkDto.CreateChunkDto },
        response: { type: ChunkDto.ChunkResponseDto, description: '新增后的枚举字典项' },
        bearerAuth: true
    })
    public async httpBaseSkylineCreateChunk(@Body() input: ChunkDto.CreateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        return this.chunkService.httpBaseSkylineCreateChunk(input)
    }

    @ApiServiceDecorator(Post('update'), {
        operation: { summary: '更新枚举字典项' },
        request: { source: 'body', type: ChunkDto.UpdateChunkDto },
        response: { type: ChunkDto.ChunkResponseDto, description: '更新后的枚举字典项' },
        bearerAuth: true
    })
    public async httpBaseSkylineUpdateChunk(@Body() input: ChunkDto.UpdateChunkDto): Promise<ChunkDto.ChunkResponseDto> {
        return this.chunkService.httpBaseSkylineUpdateChunk(input)
    }

    @ApiServiceDecorator(Post('delete'), {
        operation: { summary: '删除枚举字典项' },
        request: { source: 'body', type: ChunkDto.ChunkKeyDto },
        response: { type: ChunkDto.DeleteChunkResponseDto, description: '删除结果' },
        bearerAuth: true
    })
    public async httpBaseSkylineDeleteChunk(@Body() input: ChunkDto.ChunkKeyDto): Promise<ChunkDto.DeleteChunkResponseDto> {
        return this.chunkService.httpBaseSkylineDeleteChunk(input)
    }
}
