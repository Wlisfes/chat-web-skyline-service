import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TbSkylineDatetaskSystem } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { Repository } from 'typeorm'
import { SYSTEM_TASK_DEFINITIONS } from '@/modules/datetask/datetask.constants'
import { DatetaskSchedulerService } from '@/modules/datetask/datetask.scheduler.service'

/** 幂等写入系统内置任务定义；页面不提供新增和删除入口。 */
@Injectable()
export class DatetaskInitializerService implements OnModuleInit {
    constructor(
        @InjectRepository(TbSkylineDatetaskSystem) private readonly repository: Repository<TbSkylineDatetaskSystem>,
        private readonly datetaskSchedulerService: DatetaskSchedulerService,
        private readonly logger: Logger
    ) {}

    /** 服务启动时确保所有内置任务存在。 */
    public async onModuleInit(): Promise<void> {
        for (const definition of SYSTEM_TASK_DEFINITIONS) {
            const existing = await this.repository.findOne({ where: { taskId: definition.taskId } })
            if (existing) continue

            try {
                const result = await this.repository
                    .createQueryBuilder()
                    .insert()
                    .into(TbSkylineDatetaskSystem)
                    .values(this.repository.create(definition as never))
                    .execute()
                if (result.identifiers.length > 0) {
                    this.logger.log(`已初始化系统任务：${definition.taskName}（${definition.taskId}）`, DatetaskInitializerService.name)
                }
            } catch (error) {
                // 多实例同时启动时允许另一实例先插入同一 taskId；其他数据库错误必须继续抛出。
                if (!this.isDuplicateKeyError(error)) throw error
                const concurrent = await this.repository.findOne({ where: { taskId: definition.taskId } })
                if (!concurrent) throw error
            }
        }
        await this.datetaskSchedulerService.refresh(true)
    }

    private isDuplicateKeyError(error: unknown): boolean {
        if (!error || typeof error !== 'object') return false
        const value = error as {
            code?: unknown
            errno?: unknown
            driverError?: { code?: unknown; errno?: unknown }
        }
        return (
            value.code === 'ER_DUP_ENTRY' ||
            Number(value.errno) === 1062 ||
            value.driverError?.code === 'ER_DUP_ENTRY' ||
            Number(value.driverError?.errno) === 1062
        )
    }
}
