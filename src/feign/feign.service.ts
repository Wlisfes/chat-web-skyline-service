import { Injectable, NotFoundException } from '@nestjs/common'
import { assertUid } from '@wlisfes/chat-web-base-schema/utils'
import * as FeignSchema from '@wlisfes/chat-web-base-schema/feign'
import { ChunkService } from '@/modules/chunk/chunk.service'
import { CountryService } from '@/modules/country/country.service'
import { UserService } from '@/modules/user/user.service'

/** 统一编排 Skyline 服务对外暴露的枚举字典、账号与国家/地区还原 Feign 调用，实现与业务模块保持单向依赖。 */
@Injectable()
export class FeignService extends FeignSchema.FeignClientSkylineManager implements FeignSchema.FeignClientSkylineImplementation {
    constructor(
        private readonly chunkService: ChunkService,
        private readonly userService: UserService,
        private readonly countryService: CountryService
    ) {
        super()
    }

    /** 按枚举类型编码批量获取启用状态的枚举字典选项。 */
    public override async httpBaseSkylineChunkOptionColumn(
        _authorization: string,
        input: FeignSchema.SkylineColumnChunkOptionInput
    ): Promise<FeignSchema.SkylineChunkOptionRecord> {
        return this.chunkService.httpBaseSkylineChunkOptionColumn(input)
    }

    /** 按枚举业务值解析单个启用状态的枚举字典选项。 */
    public override async httpBaseSkylineChunkOptionResolver(
        _authorization: string,
        input: FeignSchema.SkylineChunkOptionResolverInput
    ): Promise<FeignSchema.SkylineChunkOption> {
        return this.chunkService.httpBaseSkylineChunkOptionResolver(input)
    }

    /** 按列表批量把账号 UID 还原为展示摘要。 */
    public override async httpBaseSkylineColumnUserResolver(
        _authorization: string,
        input: FeignSchema.SkylineColumnUserResolverDto
    ): Promise<FeignSchema.SkylineUserSummary[]> {
        return this.userService.httpBaseSkylineColumnUserResolver(input)
    }

    /** 按账号 UID 还原单个展示摘要；账号不存在时与公开详情接口保持一致。 */
    public override async httpBaseSkylineUserResolver(
        _authorization: string,
        input: FeignSchema.SkylineUserResolverDto
    ): Promise<FeignSchema.SkylineUserSummary> {
        const uid = assertUid(input.uid, '账号UID')
        const [user] = await this.userService.httpBaseSkylineColumnUserResolver({ uids: [uid], fields: input.fields })
        if (!user) {
            throw new NotFoundException('账号不存在')
        }
        return user
    }

    /** 按国家/地区主键批量获取展示摘要。 */
    public override async httpBaseSkylineColumnCountryResolver(
        _authorization: string,
        input: FeignSchema.SkylineColumnCountryResolverDto
    ): Promise<FeignSchema.SkylineCountrySummary[]> {
        return this.countryService.httpBaseSkylineColumnCountryResolver(input)
    }

    /** 按国际区号和 MCC 批量获取展示摘要。 */
    public override async httpBaseSkylineColumnCountryCodeResolver(
        _authorization: string,
        input: FeignSchema.SkylineColumnCountryCodeResolverDto
    ): Promise<FeignSchema.SkylineCountrySummary[]> {
        return this.countryService.httpBaseSkylineColumnCountryCodeResolver(input)
    }

    /** 按国家/地区主键获取单个展示摘要；不存在时返回 404。 */
    public override async httpBaseSkylineCountryResolver(
        _authorization: string,
        input: FeignSchema.SkylineCountryResolverDto
    ): Promise<FeignSchema.SkylineCountrySummary> {
        return this.countryService.httpBaseSkylineCountryResolver(input)
    }
}
