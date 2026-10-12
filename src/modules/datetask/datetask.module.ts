import { Module } from '@nestjs/common'
import { FeignClientTaskManager, FeignModule } from '@wlisfes/chat-web-base-schema/feign'
import { DatetaskController } from '@/modules/datetask/datetask.controller'
import { DatetaskService } from '@/modules/datetask/datetask.service'
import { UserModule } from '@/modules/user/user.module'

/** 系统任务管理模块；只做权限校验和转发，调度与执行由 chat-web-task-service 负责。 */
@Module({
    imports: [FeignModule.register([FeignClientTaskManager]), UserModule],
    controllers: [DatetaskController],
    providers: [DatetaskService],
    exports: [DatetaskService]
})
export class DatetaskModule {}
