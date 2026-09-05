import { Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FeignClientFinanceManager } from '@wlisfes/chat-web-base-schema/feign'
import { CurrencyExchangeTaskService } from './currency-exchange-task.service'

describe('CurrencyExchangeTaskService', () => {
    const originalFetch = global.fetch
    let fetchMock: jest.Mock

    afterEach(() => {
        global.fetch = originalFetch
        jest.restoreAllMocks()
    })

    function createService(config: Record<string, unknown> = {}) {
        const configService = {
            get: jest.fn((key: string) => config[key])
        } as unknown as ConfigService
        const syncCurrencyExchange = jest.fn().mockResolvedValue({ date: '2026-09-02', count: 2, list: [] })
        const financeFeignClient = {
            syncCurrencyExchange
        } as unknown as FeignClientFinanceManager
        const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger
        const service = new CurrencyExchangeTaskService(configService, financeFeignClient, logger)
        return { service, configService, financeFeignClient, syncCurrencyExchange, logger }
    }

    function mockResponse(payload: unknown, ok = true, status = 200): Response {
        return { ok, status, json: jest.fn().mockResolvedValue(payload) } as unknown as Response
    }

    it('应读取当日数组汇率并通过 Finance Feign 写入', async () => {
        const { service, financeFeignClient } = createService({ 'feign.service_token': 'finance-token' })
        fetchMock = jest.fn().mockResolvedValue(
            mockResponse([
                { date: '2026-09-02', base: 'USD', quote: 'EUR', rate: 0.91 },
                { date: '2026-09-02', base: 'USD', quote: 'JPY', rate: '157.2' }
            ])
        )
        global.fetch = fetchMock

        await service.execute()

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const requestUrl = String(fetchMock.mock.calls[0][0])
        expect(requestUrl).toContain('/v2/rates?')
        expect(requestUrl).toContain('base=USD')
        expect(requestUrl).toContain('date=')
        expect(financeFeignClient.syncCurrencyExchange).toHaveBeenCalledWith('Bearer finance-token', {
            date: '2026-09-02',
            rates: [
                { currency: 'USD', rate: 1 },
                { currency: 'EUR', rate: 0.91 },
                { currency: 'JPY', rate: 157.2 }
            ]
        })
    })

    it('当日没有数据时应回退最新汇率并优先使用请求凭据', async () => {
        const { service, financeFeignClient } = createService({ 'feign.service_token': 'configured-token' })
        fetchMock = jest
            .fn()
            .mockResolvedValueOnce(mockResponse({ message: 'weekend' }, false, 404))
            .mockResolvedValueOnce(
                mockResponse({
                    date: '2026-09-01',
                    base: 'USD',
                    rates: { eur: 0.9, CNY: 7.1 }
                })
            )
        global.fetch = fetchMock

        await service.execute('Bearer request-token')

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(String(fetchMock.mock.calls[1][0])).not.toContain('date=')
        expect(financeFeignClient.syncCurrencyExchange).toHaveBeenCalledWith('Bearer request-token', {
            date: '2026-09-01',
            rates: [
                { currency: 'USD', rate: 1 },
                { currency: 'EUR', rate: 0.9 },
                { currency: 'CNY', rate: 7.1 }
            ]
        })
    })

    it('当日接口以 200 返回空数组时也应回退最新汇率', async () => {
        const { service, financeFeignClient } = createService({ 'feign.service_token': 'configured-token' })
        fetchMock = jest
            .fn()
            .mockResolvedValueOnce(mockResponse([]))
            .mockResolvedValueOnce(mockResponse([{ date: '2026-09-01', base: 'USD', quote: 'CNY', rate: 7.1 }]))
        global.fetch = fetchMock

        await service.execute()

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(String(fetchMock.mock.calls[0][0])).toContain('date=')
        expect(String(fetchMock.mock.calls[1][0])).not.toContain('date=')
        expect(financeFeignClient.syncCurrencyExchange).toHaveBeenCalledWith('Bearer configured-token', {
            date: '2026-09-01',
            rates: [
                { currency: 'USD', rate: 1 },
                { currency: 'CNY', rate: 7.1 }
            ]
        })
    })

    it('当日接口网络失败时仍应回退最新汇率', async () => {
        const { service, financeFeignClient } = createService({ 'feign.service_token': 'configured-token' })
        fetchMock = jest
            .fn()
            .mockRejectedValueOnce(new Error('连接超时'))
            .mockResolvedValueOnce(mockResponse([{ date: '2026-09-01', base: 'USD', quote: 'CNY', rate: 7.1 }]))
        global.fetch = fetchMock

        await expect(service.execute()).resolves.toEqual({ date: '2026-09-02', count: 2, list: [] })
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(String(fetchMock.mock.calls[1][0])).not.toContain('date=')
        expect(financeFeignClient.syncCurrencyExchange).toHaveBeenCalledWith('Bearer configured-token', {
            date: '2026-09-01',
            rates: [
                { currency: 'USD', rate: 1 },
                { currency: 'CNY', rate: 7.1 }
            ]
        })
    })

    it('配置 Frankfurter 根域名时应自动使用 v2 rates 接口', async () => {
        const { service, financeFeignClient } = createService({
            'feign.service_token': 'configured-token',
            'integration.frankfurter.url': 'https://api.frankfurter.dev'
        })
        fetchMock = jest.fn().mockResolvedValue(mockResponse([{ date: '2026-09-02', quote: 'EUR', rate: 0.9 }]))
        global.fetch = fetchMock

        await service.execute()

        expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/api\.frankfurter\.dev\/v2\/rates\?/)
        expect(financeFeignClient.syncCurrencyExchange).toHaveBeenCalled()
    })

    it('请求 Frankfurter 时应使用 UTC 日历日期', () => {
        const { service } = createService({ 'feign.service_token': 'configured-token' })
        const formatDate = (service as unknown as { formatDate(value: Date): string }).formatDate.bind(service)

        expect(formatDate(new Date('2026-09-02T23:30:00.000Z'))).toBe('2026-09-02')
    })

    it('应将外部汇率舍入到 Finance 支持的 6 位小数', async () => {
        const { service, financeFeignClient } = createService({ 'feign.service_token': 'configured-token' })
        fetchMock = jest.fn().mockResolvedValue(mockResponse([{ date: '2026-09-02', quote: 'CNY', rate: 7.253456789 }]))
        global.fetch = fetchMock

        await service.execute()

        expect(financeFeignClient.syncCurrencyExchange).toHaveBeenCalledWith('Bearer configured-token', {
            date: '2026-09-02',
            rates: [
                { currency: 'USD', rate: 1 },
                { currency: 'CNY', rate: 7.253457 }
            ]
        })
    })

    it('应拒绝第三方响应中的空值和非 ISO 币种编码', async () => {
        const { service, financeFeignClient } = createService({ 'feign.service_token': 'configured-token' })
        fetchMock = jest.fn().mockResolvedValue(
            mockResponse([
                { date: '2026-09-02', quote: 'CNY', rate: 7.1 },
                { date: '2026-09-02', quote: null, rate: 1 },
                { date: '2026-09-02', quote: 'EUR', rate: null },
                { date: '2026-09-02', quote: '   ', rate: 1 },
                { date: '2026-09-02', quote: 'US D', rate: 1 },
                { date: '2026-09-02', quote: 'GBP', rate: '' }
            ])
        )
        global.fetch = fetchMock

        await service.execute()

        expect(financeFeignClient.syncCurrencyExchange).toHaveBeenCalledWith('Bearer configured-token', {
            date: '2026-09-02',
            rates: [
                { currency: 'USD', rate: 1 },
                { currency: 'CNY', rate: 7.1 }
            ]
        })
    })

    it('汇率超过 Finance 单次上限时应分批同步并合并结果', async () => {
        const { service, syncCurrencyExchange } = createService({ 'feign.service_token': 'configured-token' })
        const rates = Array.from({ length: 200 }, (_, index) => ({
            date: '2026-09-02',
            quote: `X${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`,
            rate: index + 1
        }))
        fetchMock = jest.fn().mockResolvedValue(mockResponse(rates))
        syncCurrencyExchange.mockImplementation(async (_token, input) => ({
            date: input.date,
            count: input.rates.length,
            list: input.rates.map(item => ({ ...item, date: input.date }))
        }))
        global.fetch = fetchMock

        const result = await service.execute()

        expect(syncCurrencyExchange).toHaveBeenCalledTimes(2)
        expect(syncCurrencyExchange.mock.calls[0][1].rates).toHaveLength(200)
        expect(syncCurrencyExchange.mock.calls[1][1].rates).toHaveLength(1)
        expect(result).toEqual({ date: '2026-09-02', count: 201, list: expect.any(Array) })
        expect(result.list).toHaveLength(201)
    })

    it('没有内部凭据时应返回明确的服务不可用异常', async () => {
        const { service } = createService()
        fetchMock = jest.fn().mockResolvedValue(mockResponse([{ quote: 'EUR', rate: 0.9 }]))
        global.fetch = fetchMock

        await expect(service.execute()).rejects.toEqual(
            expect.objectContaining<Partial<ServiceUnavailableException>>({
                message: '缺少 Finance 服务内部 Bearer 凭据，请配置 feign.service_token'
            })
        )
    })

    it('无有效汇率数据时应拒绝执行', async () => {
        const { service } = createService({ 'feign.service_token': 'token' })
        fetchMock = jest
            .fn()
            .mockResolvedValueOnce(mockResponse([{ quote: 'EUR', rate: 'invalid' }]))
            .mockResolvedValueOnce(mockResponse([{ quote: 'EUR', rate: 'invalid' }]))
        global.fetch = fetchMock

        await expect(service.execute()).rejects.toThrow('Frankfurter 汇率响应没有合法币种')
    })

    it('当日响应只有非法汇率时应回退最新汇率', async () => {
        const { service, financeFeignClient } = createService({ 'feign.service_token': 'configured-token' })
        fetchMock = jest
            .fn()
            .mockResolvedValueOnce(mockResponse([{ date: '2026-09-02', quote: 'EUR', rate: 'invalid' }]))
            .mockResolvedValueOnce(mockResponse([{ date: '2026-09-01', quote: 'CNY', rate: 7.1 }]))
        global.fetch = fetchMock

        await service.execute()

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(String(fetchMock.mock.calls[1][0])).not.toContain('date=')
        expect(financeFeignClient.syncCurrencyExchange).toHaveBeenCalledWith('Bearer configured-token', {
            date: '2026-09-01',
            rates: [
                { currency: 'USD', rate: 1 },
                { currency: 'CNY', rate: 7.1 }
            ]
        })
    })
})
