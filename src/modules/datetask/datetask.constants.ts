import {
    TbSkylineDatetaskSystemStatus as DatetaskStatus,
    TbSkylineDatetaskSystemType as DatetaskType
} from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'

/** 系统任务的稳定标识。使用 19 位数字字符串兼容历史任务表约定。 */
export const CURRENCY_EXCHANGE_TASK_ID = '2149446185344106496'

/** 汇率同步任务处理器标识。 */
export const CURRENCY_EXCHANGE_TASK_HANDLER = 'datetask-sync-exchange-rate'

/** 默认每天 08:00（Asia/Shanghai）执行；Cron 为秒、分、时、日、月、周。 */
export const CURRENCY_EXCHANGE_TASK_CRON = '0 0 8 * * *'

/** 任务类型值，与共享 Skyline Schema 和管理端字典保持一致。 */
export { DatetaskStatus, DatetaskType }

/** 系统任务允许通过管理接口修改的状态。 */
export enum DatetaskManageStatus {
    STOP = DatetaskStatus.STOP,
    RUNNING = DatetaskStatus.RUNNING
}

/** 任务执行日志状态。 */
export enum DatetaskLogStatus {
    RUNNING = 'running',
    SUCCESS = 'success',
    FAILED = 'failed'
}

/** 任务日志保留条数，避免单进程长期运行导致内存无界增长。 */
export const DATETASK_LOG_LIMIT = 200

/** 调度器读取任务失败后的重试间隔，避免短暂数据库抖动导致任务永久丢失。 */
export const DATETASK_SCHEDULER_RETRY_DELAY_MS = 30_000

/** Node.js 单个定时器允许的最大安全延时；更远的任务只在此间隔后重新计算。 */
export const DATETASK_MAX_TIMER_DELAY_MS = 2_147_000_000

/** 系统任务初始化定义。 */
export const SYSTEM_TASK_DEFINITIONS = [
    {
        taskId: CURRENCY_EXCHANGE_TASK_ID,
        taskName: '汇率同步定时任务',
        handler: CURRENCY_EXCHANGE_TASK_HANDLER,
        comment: '每天从 Frankfurter 获取汇率并通过 Finance 服务写入数据库',
        cron: CURRENCY_EXCHANGE_TASK_CRON,
        type: DatetaskType.SYSTEM,
        status: DatetaskStatus.RUNNING,
        body: { base: 'USD' }
    }
] as const
