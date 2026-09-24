import { Injectable } from '@nestjs/common'
import {
    FeignClientSkylineImplementation,
    FeignClientSkylineManager,
    SkylineColumnChunkOptionInput,
    SkylineChunkOption,
    SkylineChunkOptionGroup,
    SkylineResolveChunkOptionInput
} from '@wlisfes/chat-web-base-schema/feign'
import { ChunkService } from '@/modules/chunk/chunk.service'

/** 统一编排 Skyline 服务对外暴露的枚举字典 Feign 调用，实现与业务模块保持单向依赖。 */
@Injectable()
export class FeignService extends FeignClientSkylineManager implements FeignClientSkylineImplementation {
    constructor(private readonly chunkService: ChunkService) {
        super()
    }

    public override async columnChunkOptions(
        _authorization: string,
        input: SkylineColumnChunkOptionInput
    ): Promise<SkylineChunkOptionGroup[]> {
        return this.chunkService.httpBaseSkylineColumnChunkOption(input)
    }

    public override async resolveChunkOption(_authorization: string, input: SkylineResolveChunkOptionInput): Promise<SkylineChunkOption> {
        return this.chunkService.httpBaseSkylineResolverChunkOption(input)
    }
}
