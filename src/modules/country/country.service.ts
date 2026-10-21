import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { InjectRepository, DataBaseService, In, Repository } from '@wlisfes/chat-web-base-schema/database'
import { PageResult, isNotEmpty, fetchUntiePagination, fetchResolver } from '@wlisfes/chat-web-base-schema/utils'
import { CountryUtilsService } from '@/modules/country/country.utils.service'
import * as CountryDto from '@/modules/country/dto/country.dto'
import * as feign from '@wlisfes/chat-web-base-schema/feign'
import * as Schema from '@wlisfes/chat-web-base-schema'

@Injectable()
export class CountryService {
    constructor(
        @InjectRepository(Schema.TbSkylineCountry) private readonly countryRepository: Repository<Schema.TbSkylineCountry>,
        private readonly database: DataBaseService,
        private readonly countryUtilsService: CountryUtilsService,
        private readonly skylineFeignClient: feign.FeignClientSkylineManager,
        private readonly configService: ConfigService
    ) {}

    /**国家地区静态枚举*/
    public async httpBaseSkylineCountryEnums(): Promise<CountryDto.CountryEnumsResponseDto> {
        return {
            statusOptions: Schema.TbSkylineCountryStatusDefinition.options
        }
    }

    /**国家地区分页数据*/
    public async httpBaseSkylineColumnCountry(body: CountryDto.ListCountryDto): Promise<PageResult<CountryDto.CountryListItemResponseDto>> {
        const { page, size } = fetchUntiePagination(body)
        return this.database.builder(this.countryRepository, async qb => {
            if (isNotEmpty(body.cnName?.trim())) {
                qb.andWhere('(t.cnName LIKE :searchTerm OR t.enName LIKE :searchTerm OR t.code LIKE :searchTerm)', {
                    searchTerm: `%${body.cnName?.trim()}%`
                })
            }
            if (isNotEmpty(body.mcc?.trim())) {
                qb.andWhere('t.mcc LIKE :mcc', { mcc: `%${body.mcc?.trim()}%` })
            }
            if (isNotEmpty(body.status)) {
                qb.andWhere('t.status = :status', { status: body.status })
            }
            qb.orderBy('t.createTime', 'DESC')
            qb.skip((page - 1) * size)
            qb.take(size)
            return await qb.getManyAndCount().then(async ([items, total]) => {
                return fetchResolver({
                    page,
                    size,
                    total,
                    list: await feign.fetchAppendSkylineUserOptions(this.skylineFeignClient, this.configService, items, [
                        'createBy',
                        'modifyBy'
                    ])
                })
            })
        })
    }

    /**编辑国家地区状态*/
    public async httpBaseSkylineCountryStatusUpdate(
        principal: AuthPrincipal,
        body: CountryDto.UpdateCountryStatusDto
    ): Promise<Schema.TbSkylineCountry> {
        return this.countryRepository.manager.transaction(async manager => {
            const country = await this.countryUtilsService.findRequired(body.keyId, manager)
            country.status = body.status
            country.modifyBy = principal.uid
            return manager.save(country)
        })
    }

    /**国家地区下拉数据*/
    public async httpBaseSkylineSelectCountry(): Promise<CountryDto.CountrySelectResponseDto[]> {
        return await this.database.builder(this.countryRepository, qb => {
            qb.select(['t.keyId', 't.code', 't.mcc', 't.cnName', 't.enName'])
            qb.where('t.status = :status', { status: Schema.TbSkylineCountryStatus.ENABLE })
            qb.orderBy('t.createTime', 'DESC')
            return qb.getMany().then(items => {
                return items.map(item => {
                    const showName = `${item.code} ${item.cnName} - ${item.enName}`
                    return { ...item, showName, value: item.keyId, label: showName }
                })
            })
        })
    }

    /** 按主键批量获取国家/地区展示摘要，供 Feign 使用；单次最多 100 个，不存在的主键直接忽略，不按启用状态过滤。 */
    public async httpBaseSkylineColumnCountryResolver(
        input: feign.SkylineColumnCountryResolverDto
    ): Promise<feign.SkylineCountrySummary[]> {
        const keyIds = [...new Set(input.keyIds ?? [])].filter(keyId => Number.isInteger(keyId) && keyId > 0)
        if (keyIds.length === 0) {
            return []
        }
        if (keyIds.length > 100) {
            throw new BadRequestException('单次最多查询100个国家/地区')
        }
        return this.countryRepository.find({
            select: { keyId: true, code: true, mcc: true, cnName: true, enName: true, status: true },
            where: { keyId: In(keyIds) }
        })
    }

    /** 按国际区号和 MCC 批量获取展示摘要，供 Feign 使用；单次最多 100 组，不存在的组合直接忽略。 */
    public async httpBaseSkylineColumnCountryCodeResolver(input: {
        items?: Array<{ code: string; mcc: string }>
    }): Promise<feign.SkylineCountrySummary[]> {
        const items = [...new Map((input.items ?? []).map(item => [`${item.code}:${item.mcc}`, item])).values()]
        if (items.length === 0) {
            return []
        }
        if (items.length > 100) {
            throw new BadRequestException('单次最多查询100个国家/地区')
        }
        return this.database.builder(this.countryRepository, async qb => {
            const params: Record<string, string> = {}
            const clauses = items.map((item, index) => {
                params[`code${index}`] = item.code
                params[`mcc${index}`] = item.mcc
                return `(t.code = :code${index} AND t.mcc = :mcc${index})`
            })
            qb.select(['t.keyId', 't.code', 't.mcc', 't.cnName', 't.enName', 't.status'])
            qb.where(clauses.join(' OR '), params)
            return qb.getMany()
        })
    }

    /** 按主键获取单个国家/地区展示摘要，供 Feign 使用；不存在时抛出 404。 */
    public async httpBaseSkylineCountryResolver(input: feign.SkylineCountryResolverDto): Promise<feign.SkylineCountrySummary> {
        const [country] = await this.httpBaseSkylineColumnCountryResolver({ keyIds: [input.keyId] })
        if (!country) {
            throw new NotFoundException('国家/地区不存在')
        }
        return country
    }
}
