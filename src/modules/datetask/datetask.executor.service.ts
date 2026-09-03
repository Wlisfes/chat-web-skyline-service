import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { TbSkylineDatetaskSystem } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { DataSource, EntityManager, QueryRunner } from 'typeorm'
import { CURRENCY_EXCHANGE_TASK_HANDLER, DatetaskLogStatus, DatetaskStatus } from '@/modules/datetask/datetask.constants'
import { CurrencyExchangeTaskService } from '@/modules/datetask/currency-exchange-task.service'
import { DatetaskLogService } from '@/modules/datetask/datetask.log.service'
import { DatetaskRecord, DatetaskUtilsService } from '@/modules/datetask/datetask.utils.service'
import { DatetaskExecutionResultDto } from '@/modules/datetask/dto/datetask.dto'

interface DistributedLock {
    queryRunner: QueryRunner
    name: string
}

/** 统一执行已注册的系统任务并记录最近执行结果。 */
@Injectable()
export class DatetaskExecutorService {
    private readonly running = new Set<string>()

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        private readonly datetaskUtilsService: DatetaskUtilsService,
        private readonly datetaskLogService: DatetaskLogService,
        private readonly currencyExchangeTaskService: CurrencyExchangeTaskService,
        private readonly logger: Logger
    ) {}

    /** 执行一次任务；同一进程内同一任务不会并发执行。 */
    public async execute(taskId: string, authorization?: string): Promise<DatetaskExecutionResultDto> {
        if (this.running.has(taskId)) {
            this.logger.warn(`任务正在执行，跳过本次触发：${taskId}`, DatetaskExecutorService.name)
            return { skipped: true, reason: '任务正在执行' }
        }

        this.running.add(taskId)
        let distributedLock: DistributedLock | undefined
        let task: DatetaskRecord | undefined
        let executionId: string | undefined
        try {
            distributedLock = await this.acquireDistributedLock(taskId)
            if (!distributedLock) return { skipped: true, reason: '任务正在其他实例执行' }

            // GET_LOCK 已在当前 MySQL 会话提供互斥；此处没有开启事务，禁止再请求事务级悲观锁。
            task = await this.datetaskUtilsService.findRequired(taskId, distributedLock.queryRunner.manager, false)
            if (task.status === DatetaskStatus.STOP) {
                return { skipped: true, reason: '任务已停用' }
            }
            if (task.status === DatetaskStatus.FINISH) {
                return { skipped: true, reason: '任务已完成' }
            }
            if (task.status !== DatetaskStatus.RUNNING && task.status !== DatetaskStatus.WAIT) {
                return { skipped: true, reason: '任务当前不可执行' }
            }

            const startedAt = new Date()
            executionId = this.datetaskLogService.appendRunning(taskId, startedAt, task.taskName)
            try {
                const result = await this.executeHandler(task, authorization)
                const endedAt = new Date()
                await this.updateLastTime(task, endedAt, distributedLock.queryRunner.manager)
                const record = {
                    taskId,
                    status: DatetaskLogStatus.SUCCESS,
                    duration: endedAt.getTime() - startedAt.getTime(),
                    startTime: this.formatDate(startedAt),
                    endTime: this.formatDate(endedAt),
                    result,
                    taskName: task.taskName
                }
                this.datetaskLogService.complete(executionId, record)
                return result
            } catch (error) {
                const endedAt = new Date()
                await this.updateLastTimeSafely(task, endedAt, distributedLock.queryRunner.manager)
                const message = this.errorMessage(error)
                const record = {
                    taskId,
                    status: DatetaskLogStatus.FAILED,
                    duration: endedAt.getTime() - startedAt.getTime(),
                    startTime: this.formatDate(startedAt),
                    endTime: this.formatDate(endedAt),
                    result: { message },
                    taskName: task.taskName
                }
                this.datetaskLogService.complete(executionId, record)
                this.logger.error(
                    `系统任务执行失败：任务ID=${taskId}，处理器=${task.handler}，原因=${message}`,
                    undefined,
                    DatetaskExecutorService.name
                )
                throw error
            }
        } finally {
            await this.releaseDistributedLock(distributedLock)
            this.running.delete(taskId)
        }
    }

    /** 返回任务当前是否正在执行。 */
    public isRunning(taskId: string): boolean {
        return this.running.has(taskId)
    }

    private async executeHandler(task: DatetaskRecord, authorization?: string): Promise<DatetaskExecutionResultDto> {
        if (task.handler === CURRENCY_EXCHANGE_TASK_HANDLER) {
            return this.currencyExchangeTaskService.execute(authorization)
        }
        throw new BadRequestException(`未注册的任务处理器：${task.handler}`)
    }

    /** 使用 MySQL 会话级锁，避免多 Pod 同时执行同一系统任务。 */
    private async acquireDistributedLock(taskId: string): Promise<DistributedLock | undefined> {
        const queryRunner = this.dataSource.createQueryRunner()
        const name = `chat-web-skyline:datetask:${taskId}`
        let released = false
        const releaseQueryRunner = async (): Promise<void> => {
            if (released) return
            released = true
            await queryRunner.release().catch(() => undefined)
        }
        try {
            await queryRunner.connect()
            const rows = (await queryRunner.query('SELECT GET_LOCK(?, 0) AS acquired', [name])) as Array<{
                acquired?: number | string | null
            }>
            const acquired = rows?.[0]?.acquired
            if (acquired === 1 || acquired === '1') return { queryRunner, name }
            if (acquired === 0 || acquired === '0') {
                await releaseQueryRunner()
                return undefined
            }

            // MySQL GET_LOCK 返回 NULL 或其他值时表示调用异常，不能当成“其他实例持有锁”静默跳过。
            await releaseQueryRunner()
            throw new ServiceUnavailableException('获取系统任务分布式锁失败')
        } catch (error) {
            await releaseQueryRunner()
            throw error
        }
    }

    /** 释放 MySQL 会话级锁；释放失败不能覆盖任务执行结果。 */
    private async releaseDistributedLock(lock?: DistributedLock): Promise<void> {
        if (!lock) return
        try {
            await lock.queryRunner.query('SELECT RELEASE_LOCK(?)', [lock.name])
        } catch (error) {
            this.logger.warn(`释放系统任务分布式锁失败：${this.errorMessage(error)}`, DatetaskExecutorService.name)
        } finally {
            await lock.queryRunner.release().catch(error => {
                this.logger.warn(`释放系统任务数据库连接失败：${this.errorMessage(error)}`, DatetaskExecutorService.name)
            })
        }
    }

    private async updateLastTime(task: DatetaskRecord, endedAt: Date, manager: EntityManager): Promise<void> {
        await manager.update(TbSkylineDatetaskSystem, { taskId: task.taskId }, { lastTime: endedAt } as never)
    }

    private async updateLastTimeSafely(task: DatetaskRecord, endedAt: Date, manager: EntityManager): Promise<void> {
        try {
            await this.updateLastTime(task, endedAt, manager)
        } catch (error) {
            this.logger.warn(`更新系统任务 ${task.taskId} 上次执行时间失败：${this.errorMessage(error)}`, DatetaskExecutorService.name)
        }
    }

    private formatDate(value: Date): string {
        return value.toISOString().replace('T', ' ').replace('Z', '')
    }

    private errorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error)
    }
}
