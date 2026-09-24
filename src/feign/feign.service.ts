import { Injectable } from '@nestjs/common'
import * as FeignSchema from '@wlisfes/chat-web-base-schema/feign'
import { ChunkService } from '@/modules/chunk/chunk.service'

/** 统一编排 Skyline 服务对外暴露的枚举字典 Feign 调用，实现与业务模块保持单向依赖。 */
@Injectable()
export class FeignService extends FeignSchema.FeignClientSkylineManager implements FeignSchema.FeignClientSkylineImplementation {
    constructor(private readonly chunkService: ChunkService) {
        super()
    }

    /** 按枚举类型编码批量获取启用状态的枚举字典选项。 */
    public override async httpBaseSkylineColumnChunkOption(
        _authorization: string,
        input: FeignSchema.SkylineColumnChunkOptionInput
    ): Promise<FeignSchema.SkylineChunkOptionGroup[]> {
        return this.chunkService.httpBaseSkylineColumnChunkOption(input)
    }

    /** 按枚举业务值解析单个启用状态的枚举字典选项。 */
    public override async httpBaseSkylineChunkOptionResolver(
        _authorization: string,
        input: FeignSchema.SkylineChunkOptionResolverInput
    ): Promise<FeignSchema.SkylineChunkOption> {
        return this.chunkService.httpBaseSkylineChunkOptionResolver(input)
    }
}
