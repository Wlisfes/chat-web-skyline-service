import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { FeignClientSkylineManager, FeignModule } from '@wlisfes/chat-web-base-schema/feign'
import { TbSkylineCountry } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { CountryController } from '@/modules/country/country.controller'
import { CountryService } from '@/modules/country/country.service'
import { CountryUtilsService } from '@/modules/country/country.utils.service'

/** Skyline 国家/地区基础数据模块。 */
@Module({
    imports: [TypeOrmModule.forFeature([TbSkylineCountry]), FeignModule.register([FeignClientSkylineManager])],
    controllers: [CountryController],
    providers: [CountryService, CountryUtilsService],
    exports: [CountryService]
})
export class CountryModule {}
