import { Body, Get, Post, Query } from '@nestjs/common'
import { CurrentPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import type { AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { ChunkService } from '@/modules/chunk/chunk.service'
import * as ChunkDto from '@/modules/chunk/dto/chunk.dto'
import * as feign from '@wlisfes/chat-web-base-schema/feign'

/** Skyline 枚举字典管理接口。 */
@ApifoxController('Skyline 枚举字典管理', 'deploy/chunk', { bearerAuth: true })
export class ChunkController {
    constructor(private readonly chunkService: ChunkService) {}

    @ApiServiceDecorator(Get('enums'), {
        operation: { summary: '枚举字典静态枚举' },
        response: { type: ChunkDto.ChunkEnumsResponseDto, description: '枚举字典静态枚举' },
        bearerAuth: true
    })
    public async httpBaseSkylineChunkEnums(): Promise<ChunkDto.ChunkEnumsResponseDto> {
        return this.chunkService.httpBaseSkylineChunkEnums()
    }

    @ApiServiceDecorator(Post('column/module'), {
        operation: { summary: '枚举分类分页列表' },
        request: { source: 'body', type: ChunkDto.ListChunkModuleDto },
        response: { type: ChunkDto.ChunkModulePageResponseDto, description: '枚举分类分页数据' },
        bearerAuth: true
    })
    public async httpBaseSkylineColumnChunkModule(@Body() input: ChunkDto.ListChunkModuleDto) {
        return this.chunkService.httpBaseSkylineColumnChunkModule(input)
    }

    @ApiServiceDecorator(Post('column'), {
        operation: { summary: '枚举字典分页列表' },
        request: { source: 'body', type: ChunkDto.ListChunkDto },
        response: { type: ChunkDto.ChunkPageResponseDto, description: '枚举字典分页数据' },
        bearerAuth: true
    })
    public async httpBaseSkylineColumnChunk(@Body() input: ChunkDto.ListChunkDto) {
        return this.chunkService.httpBaseSkylineColumnChunk(input)
    }

    @ApiServiceDecorator(Post('column/option'), {
        operation: { summary: '按枚举类型编码批量获取启用状态的枚举字典选项' },
        request: { source: 'body', type: feign.SkylineColumnChunkOptionRequestDto },
        response: { type: feign.SkylineChunkOptionGroupDto, isArray: true, description: '按枚举类型编码分组的枚举字典选项' },
        bearerAuth: true
    })
    public async httpBaseSkylineColumnChunkOption(
        @Body() input: feign.SkylineColumnChunkOptionRequestDto
    ): Promise<feign.SkylineChunkOptionGroup[]> {
        return this.chunkService.httpBaseSkylineColumnChunkOption(input)
    }

    @ApiServiceDecorator(Get('resolve'), {
        operation: { summary: '枚举字典详情' },
        request: { source: 'query', type: ChunkDto.ChunkKeyDto },
        response: { type: ChunkDto.ChunkResponseDto, description: '枚举字典详情' },
        bearerAuth: true
    })
    public async httpBaseSkylineChunkResolver(@Query() query: ChunkDto.ChunkKeyDto): Promise<ChunkDto.ChunkResponseDto> {
        return this.chunkService.httpBaseSkylineChunkResolver(query)
    }

    @ApiServiceDecorator(Post('create'), {
        operation: { summary: '新增枚举字典项' },
        request: { source: 'body', type: ChunkDto.CreateChunkDto },
        response: { type: ChunkDto.ChunkResponseDto, description: '新增后的枚举字典项' },
        bearerAuth: true
    })
    public async httpBaseSkylineCreateChunk(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() input: ChunkDto.CreateChunkDto
    ): Promise<ChunkDto.ChunkResponseDto> {
        return this.chunkService.httpBaseSkylineCreateChunk(principal, input)
    }

    @ApiServiceDecorator(Post('update'), {
        operation: { summary: '更新枚举字典项' },
        request: { source: 'body', type: ChunkDto.UpdateChunkDto },
        response: { type: ChunkDto.ChunkResponseDto, description: '更新后的枚举字典项' },
        bearerAuth: true
    })
    public async httpBaseSkylineUpdateChunk(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() input: ChunkDto.UpdateChunkDto
    ): Promise<ChunkDto.ChunkResponseDto> {
        return this.chunkService.httpBaseSkylineUpdateChunk(principal, input)
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
