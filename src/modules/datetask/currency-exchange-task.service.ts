import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
    FeignClientFinanceManager,
    FinanceCurrencyExchangeSyncResponse,
    resolveFeignServiceAuthorization
} from '@wlisfes/chat-web-base-schema/feign'

/** 只负责任务调度与触发；汇率拉取、过滤和持久化全部由 Finance 服务完成。 */
@Injectable()
export class CurrencyExchangeTaskService {
    constructor(
        private readonly configService: ConfigService,
        private readonly financeFeignClient: FeignClientFinanceManager,
        private readonly logger: Logger
    ) {}

    /** 使用服务间凭据触发 Finance 汇率同步接口。 */
    public async execute(): Promise<FinanceCurrencyExchangeSyncResponse> {
        const authorization = resolveFeignServiceAuthorization(this.configService)
        const result = await this.financeFeignClient.syncCurrencyExchange(authorization)
        this.logger.log(`Finance 汇率同步触发完成：日期=${result.date}，写入=${result.count} 条`, CurrencyExchangeTaskService.name)
        return result
    }
}
