import { Body, Get, Post } from '@nestjs/common'
import { CurrentPrincipal, RequirePermissions, type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { CountryService } from '@/modules/country/country.service'
import * as Schema from '@wlisfes/chat-web-base-schema'
import * as CountryDto from '@/modules/country/dto/country.dto'

/** Skyline 国家/地区基础数据管理接口。 */
@ApifoxController('Skyline 国家地区', 'deploy/country', { bearerAuth: true })
export class CountryController {
    constructor(private readonly countryService: CountryService) {}

    @RequirePermissions('chat:deploy:basic:country')
    @ApiServiceDecorator(Get('enums'), {
        operation: { summary: '获取国家地区状态枚举' },
        response: { type: CountryDto.CountryEnumsResponseDto, description: '国家地区静态枚举' }
    })
    public async httpBaseSkylineCountryEnums() {
        return this.countryService.httpBaseSkylineCountryEnums()
    }

    @RequirePermissions('chat:deploy:basic:country')
    @ApiServiceDecorator(Post('column'), {
        operation: { summary: '分页查询国家地区' },
        request: { source: 'body', type: CountryDto.ListCountryDto },
        response: { type: CountryDto.CountryPageResponseDto, description: '国家地区分页数据' }
    })
    public async httpBaseSkylineColumnCountry(@Body() input: CountryDto.ListCountryDto) {
        return this.countryService.httpBaseSkylineColumnCountry(input)
    }

    @RequirePermissions('chat:deploy:basic:country:update')
    @ApiServiceDecorator(Post('status/update'), {
        operation: { summary: '更新国家地区状态' },
        request: { source: 'body', type: CountryDto.UpdateCountryStatusDto },
        response: { type: Schema.TbSkylineCountryDto, description: '更新后的国家地区信息' }
    })
    public async httpBaseSkylineCountryStatusUpdate(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() input: CountryDto.UpdateCountryStatusDto
    ) {
        return this.countryService.httpBaseSkylineCountryStatusUpdate(principal, input)
    }

    @RequirePermissions('*')
    @ApiServiceDecorator(Post('select'), {
        operation: { summary: '获取可用国家地区下拉选项' },
        response: { type: CountryDto.CountrySelectResponseDto, isArray: true, description: '可用国家地区列表' }
    })
    public async httpBaseSkylineSelectCountry() {
        return this.countryService.httpBaseSkylineSelectCountry()
    }
}
