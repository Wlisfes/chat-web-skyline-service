import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
    FeignClientFinanceManager,
    FinanceCurrencyExchangeSyncRequest,
    FinanceCurrencyExchangeSyncResponse
} from '@wlisfes/chat-web-base-schema/feign'

interface FrankfurterRateRow {
    date?: string
    base?: string
    quote?: string
    rate?: number | string
}

interface FrankfurterRatesObject {
    date?: string
    base?: string
    rates?: Record<string, number | string>
}

/** Finance 汇率同步 DTO 的单次请求上限。 */
const FINANCE_SYNC_BATCH_SIZE = 200

/** 通过 Frankfurter 获取汇率并委托 Finance 服务持久化。 */
@Injectable()
export class CurrencyExchangeTaskService {
    constructor(
        private readonly configService: ConfigService,
        private readonly financeFeignClient: FeignClientFinanceManager,
        private readonly logger: Logger
    ) {}

    /** 执行一次每日汇率同步任务。 */
    public async execute(authorization?: string): Promise<FinanceCurrencyExchangeSyncResponse> {
        const fetched = await this.fetchFrankfurterRates()
        const token = this.resolveAuthorization(authorization)
        const results: FinanceCurrencyExchangeSyncResponse[] = []

        // Finance 的同步 DTO 限制单次最多 200 个币种。Frankfurter 的覆盖范围会随数据源变化，
        // 因此不能假设一次响应永远小于该上限；分批仍使用同一日期和幂等 upsert 语义。
        for (let index = 0; index < fetched.rates.length; index += FINANCE_SYNC_BATCH_SIZE) {
            const request: FinanceCurrencyExchangeSyncRequest = {
                date: fetched.date,
                rates: fetched.rates.slice(index, index + FINANCE_SYNC_BATCH_SIZE)
            }
            results.push(await this.financeFeignClient.syncCurrencyExchange(token, request))
        }

        const result: FinanceCurrencyExchangeSyncResponse = {
            date: results.at(-1)?.date ?? fetched.date,
            count: results.reduce((total, item) => total + item.count, 0),
            list: results.flatMap(item => item.list)
        }
        this.logger.log(`汇率同步完成：日期=${result.date}，写入=${result.count} 条`, CurrencyExchangeTaskService.name)
        return result
    }

    private async fetchFrankfurterRates(): Promise<{ date: string; rates: Array<{ currency: string; rate: number }> }> {
        const requestedDate = this.formatDate(new Date())
        // 优先使用当前 Nacos 嵌套配置，同时兼容历史顶层键，避免为了代码升级强制改动人工配置。
        const endpoint =
            this.configService.get<string>('integration.frankfurter.url')?.trim() ||
            this.configService.get<string>('SKYLINE_FRANKFURTER_URL')?.trim() ||
            'https://api.frankfurter.dev/v2/rates'
        const requestedUrl = this.createFrankfurterUrl(endpoint, requestedDate)
        let payload: unknown
        let rows: FrankfurterRateRow[] = []
        let rates: Array<{ currency: string; rate: number }> = []

        // 周末或节假日可能返回 HTTP 200 但没有数据，因此不能只按 HTTP 状态判断是否需要回退。
        try {
            const requestedResponse = await this.fetchFrankfurterResponse(requestedUrl)
            if (requestedResponse.ok) {
                payload = await this.readFrankfurterPayload(requestedResponse)
                rows = this.parseRates(payload)
                rates = this.normalizeRates(rows)
            }
        } catch {
            // 当日接口超时或暂时不可达时，仍尝试 latest；只有两次请求都失败才让任务失败。
        }

        // 交易日接口可能返回结构正确但所有汇率值非法；只有存在合法汇率时才认为当日响应可用。
        if (!rates.length) {
            const latestResponse = await this.fetchFrankfurterResponse(this.createFrankfurterUrl(endpoint))
            if (!latestResponse.ok) throw new ServiceUnavailableException(`Frankfurter 汇率服务返回 HTTP ${latestResponse.status}`)
            payload = await this.readFrankfurterPayload(latestResponse)
            rows = this.parseRates(payload)
            rates = this.normalizeRates(rows)
        }

        if (!rates.length) {
            throw new ServiceUnavailableException(`Frankfurter 汇率响应${rows.length ? '没有合法币种' : '没有可用数据'}`)
        }
        const date = this.resolveDate(payload, rows, requestedDate)
        if (!rates.some(row => row.currency === 'USD')) rates.unshift({ currency: 'USD', rate: 1 })
        return { date, rates: this.uniqueRates(rates) }
    }

    private createFrankfurterUrl(endpoint: string, date?: string): URL {
        const url = new URL(endpoint)
        // 允许 Nacos 直接配置文档中给出的根域名，也兼容完整的 /v2/rates 地址。
        // 根域名本身不是汇率接口，必须补上当前 Frankfurter v2 路径。
        if (url.pathname === '' || url.pathname === '/') url.pathname = '/v2/rates'
        url.searchParams.set('base', 'USD')
        if (date) url.searchParams.set('date', date)
        else url.searchParams.delete('date')
        return url
    }

    private async fetchFrankfurterResponse(url: URL): Promise<Response> {
        try {
            return await fetch(url, { signal: AbortSignal.timeout(this.getTimeout()) })
        } catch (error) {
            throw new ServiceUnavailableException(`Frankfurter 汇率服务连接失败：${this.errorMessage(error)}`)
        }
    }

    private async readFrankfurterPayload(response: Response): Promise<unknown> {
        try {
            return await response.json()
        } catch (error) {
            throw new ServiceUnavailableException(`Frankfurter 汇率响应不是有效 JSON：${this.errorMessage(error)}`)
        }
    }

    private parseRates(payload: unknown): FrankfurterRateRow[] {
        if (Array.isArray(payload)) return payload.filter(this.isRateRow)
        if (!payload || typeof payload !== 'object') return []
        const value = payload as FrankfurterRatesObject
        if (value.rates && typeof value.rates === 'object' && !Array.isArray(value.rates)) {
            return Object.entries(value.rates).map(([quote, rate]) => ({
                quote,
                rate,
                base: value.base,
                date: value.date
            }))
        }
        return []
    }

    private resolveDate(payload: unknown, rows: FrankfurterRateRow[], fallback: string): string {
        const value = payload && typeof payload === 'object' ? (payload as FrankfurterRatesObject).date : undefined
        const date = value ?? rows.find(row => row.date)?.date
        return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallback
    }

    private isRateRow(value: unknown): value is FrankfurterRateRow {
        return Boolean(value && typeof value === 'object' && 'quote' in value && 'rate' in value)
    }

    private normalizeRates(rows: FrankfurterRateRow[]): Array<{ currency: string; rate: number }> {
        return rows.flatMap(row => {
            // 第三方响应是运行时数据，不能依赖 TypeScript 接口保证字段类型；尤其要拒绝
            // null/布尔值/空字符串，否则 Number(value) 会把它们误转成 0 并写入数据库。
            if (typeof row.quote !== 'string' || !row.quote.trim()) return []
            if (typeof row.rate !== 'number' && typeof row.rate !== 'string') return []
            if (typeof row.rate === 'string' && !row.rate.trim()) return []

            const currency = row.quote.trim().toUpperCase()
            const rate = Number(row.rate)
            // Finance 使用 ISO 4217 三位币种编码；发送前统一舍入到数据库支持的 6 位小数。
            if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(rate) || rate < 0) return []
            return [{ currency, rate: Number(rate.toFixed(6)) }]
        })
    }

    private uniqueRates(rates: Array<{ currency: string; rate: number }>): Array<{ currency: string; rate: number }> {
        const seen = new Set<string>()
        return rates.filter(rate => {
            if (seen.has(rate.currency)) return false
            seen.add(rate.currency)
            return true
        })
    }

    private resolveAuthorization(authorization?: string): string {
        const requestToken = authorization?.trim()
        if (requestToken && /^Bearer\s+\S+$/i.test(requestToken)) return requestToken

        // `feign.service_token` 是当前约定；`security.serviceToken` 是历史 Nacos 字段，均只读不回写。
        const configured =
            this.configService.get<string>('feign.service_token')?.trim() || this.configService.get<string>('security.serviceToken')?.trim()
        if (typeof configured !== 'string' || !configured.trim()) {
            throw new ServiceUnavailableException('缺少 Finance 服务内部 Bearer 凭据，请配置 feign.service_token')
        }
        const token = configured.trim()
        return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`
    }

    private getTimeout(): number {
        const configured =
            this.configService.get<number | string>('integration.frankfurter.timeout') ??
            this.configService.get<number | string>('FRANKFURTER_TIMEOUT_MS')
        const timeout = configured === undefined || configured === '' ? 10_000 : Number(configured)
        return Number.isInteger(timeout) && timeout >= 1000 && timeout <= 60_000 ? timeout : 10_000
    }

    private formatDate(value: Date): string {
        // Frankfurter 的日期接口按 UTC 日历日期查询；使用本地时区可能在午夜附近请求尚未发布的未来日期。
        return value.toISOString().slice(0, 10)
    }

    private errorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error)
    }
}
