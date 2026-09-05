import { Logger, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { FeignClientFinanceManager, FeignModule } from '@wlisfes/chat-web-base-schema/feign'
import { TbSkylineDatetaskSystem } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { CurrencyExchangeTaskService } from '@/modules/datetask/currency-exchange-task.service'
import { DatetaskController } from '@/modules/datetask/datetask.controller'
import { DatetaskExecutorService } from '@/modules/datetask/datetask.executor.service'
import { DatetaskInitializerService } from '@/modules/datetask/datetask.initializer.service'
import { DatetaskLogService } from '@/modules/datetask/datetask.log.service'
import { DatetaskSchedulerService } from '@/modules/datetask/datetask.scheduler.service'
import { DatetaskService } from '@/modules/datetask/datetask.service'
import { DatetaskUtilsService } from '@/modules/datetask/datetask.utils.service'

/** Skyline 系统任务模块；仅暴露内置任务的查询和运维操作。 */
@Module({
    imports: [TypeOrmModule.forFeature([TbSkylineDatetaskSystem]), FeignModule.register([FeignClientFinanceManager])],
    controllers: [DatetaskController],
    providers: [
        Logger,
        DatetaskService,
        DatetaskUtilsService,
        DatetaskLogService,
        DatetaskExecutorService,
        DatetaskSchedulerService,
        DatetaskInitializerService,
        CurrencyExchangeTaskService
    ],
    exports: [DatetaskService]
})
export class DatetaskModule {}
