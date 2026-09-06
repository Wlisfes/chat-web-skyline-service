import { Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FeignClientFinanceManager } from '@wlisfes/chat-web-base-schema/feign'
import { CurrencyExchangeTaskService } from './currency-exchange-task.service'

describe('CurrencyExchangeTaskService', () => {
    function createService(config: Record<string, unknown> = {}) {
        const configService = {
            get: jest.fn((key: string) => config[key])
        } as unknown as ConfigService
        const syncCurrencyExchange = jest.fn().mockResolvedValue({
            date: '2026-09-05',
            count: 28,
            list: [{ currency: 'USD', rate: 1, date: '2026-09-05' }]
        })
        const financeFeignClient = { syncCurrencyExchange } as unknown as FeignClientFinanceManager
        const logger = { log: jest.fn() } as unknown as Logger
        const service = new CurrencyExchangeTaskService(configService, financeFeignClient, logger)
        return { service, syncCurrencyExchange, logger }
    }

    it('应只携带服务凭据触发 Finance 汇率同步', async () => {
        const { service, syncCurrencyExchange, logger } = createService({ 'feign.service_token': 'finance-token' })

        await expect(service.execute()).resolves.toEqual({
            date: '2026-09-05',
            count: 28,
            list: [{ currency: 'USD', rate: 1, date: '2026-09-05' }]
        })
        expect(syncCurrencyExchange).toHaveBeenCalledTimes(1)
        expect(syncCurrencyExchange).toHaveBeenCalledWith('Bearer finance-token')
        expect(logger.log).toHaveBeenCalledWith('Finance 汇率同步触发完成：日期=2026-09-05，写入=28 条', CurrencyExchangeTaskService.name)
    })

    it('已带 Bearer 前缀的服务凭据不应重复拼接', async () => {
        const { service, syncCurrencyExchange } = createService({ 'feign.service_token': 'Bearer finance-token' })

        await service.execute()

        expect(syncCurrencyExchange).toHaveBeenCalledWith('Bearer finance-token')
    })

    it('缺少服务凭据时应在调用 Finance 前直接失败', async () => {
        const { service, syncCurrencyExchange } = createService()

        await expect(service.execute()).rejects.toEqual(
            expect.objectContaining<Partial<ServiceUnavailableException>>({
                message: 'Nacos 配置 feign.service_token 未配置服务间凭据'
            })
        )
        expect(syncCurrencyExchange).not.toHaveBeenCalled()
    })
})
