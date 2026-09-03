import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TbSkylineDatetaskSystem } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { In, Repository } from 'typeorm'
import { DATETASK_MAX_TIMER_DELAY_MS, DATETASK_SCHEDULER_RETRY_DELAY_MS, DatetaskStatus } from '@/modules/datetask/datetask.constants'
import { DatetaskExecutorService } from '@/modules/datetask/datetask.executor.service'
import { DatetaskUtilsService } from '@/modules/datetask/datetask.utils.service'

/** 基于任务表 Cron 配置的轻量调度器；无需引入第二套队列服务。 */
@Injectable()
export class DatetaskSchedulerService implements OnModuleDestroy {
    private readonly timers = new Map<string, NodeJS.Timeout>()
    private readonly generations = new Map<string, number>()
    /** 刷新失败时使用独立的重试定时器，不能与任务定时器混用。 */
    private refreshRetryTimer?: NodeJS.Timeout
    /** 防止较早发起的异步刷新结果覆盖较新的刷新结果。 */
    private refreshVersion = 0

    constructor(
        @InjectRepository(TbSkylineDatetaskSystem) private readonly repository: Repository<TbSkylineDatetaskSystem>,
        private readonly datetaskUtilsService: DatetaskUtilsService,
        private readonly datetaskExecutorService: DatetaskExecutorService,
        private readonly logger: Logger
    ) {}

    /** 模块销毁时清理所有定时器。 */
    public onModuleDestroy(): void {
        this.refreshVersion += 1
        for (const timer of this.timers.values()) clearTimeout(timer)
        this.timers.clear()
        if (this.refreshRetryTimer) clearTimeout(this.refreshRetryTimer)
        this.refreshRetryTimer = undefined
        this.generations.clear()
    }

    /**
     * 从数据库重新加载并注册任务。
     *
     * 启动阶段使用严格模式，数据库读取失败必须阻止应用在“无调度”状态下继续提供服务；
     * 运行期间的刷新保留容错行为，由调用方决定后续是否重试。
     */
    public async refresh(strict = false): Promise<void> {
        const version = ++this.refreshVersion
        let tasks: TbSkylineDatetaskSystem[]
        try {
            tasks = await this.repository.find({ where: { status: In([DatetaskStatus.RUNNING, DatetaskStatus.WAIT]) } })
        } catch (error) {
            this.logger.error(`加载系统任务失败：${this.errorMessage(error)}`, undefined, DatetaskSchedulerService.name)
            if (strict) throw error
            if (version === this.refreshVersion) this.scheduleRefreshRetry()
            return
        }

        // 只在读取成功且仍是最新刷新请求时替换调度；读取失败或过期结果都不能清空现有任务。
        if (version !== this.refreshVersion) return
        this.clearTaskTimers()
        this.clearRefreshRetry()

        for (const task of tasks) {
            if (this.datetaskUtilsService.isSchedulable(task)) this.schedule(task.taskId)
        }
        this.logger.log(`系统任务调度器已加载 ${tasks.length} 条任务`, DatetaskSchedulerService.name)
    }

    /** 注册单个任务；任务状态或 Cron 变化后由业务服务调用。 */
    public schedule(taskId: string): void {
        // 使正在读取列表的旧 refresh 结果失效，避免覆盖刚刚由业务更新的单任务调度。
        this.refreshVersion += 1
        const previous = this.timers.get(taskId)
        if (previous) clearTimeout(previous)
        this.timers.delete(taskId)
        const generation = this.bumpGeneration(taskId)
        void this.scheduleNext(taskId, generation).catch(error => {
            this.logger.error(`任务 ${taskId} 调度失败：${this.errorMessage(error)}`, undefined, DatetaskSchedulerService.name)
            this.scheduleRetry(taskId, generation)
        })
    }

    /** 取消单个任务调度。 */
    public unschedule(taskId: string): void {
        // 使正在读取列表的旧 refresh 结果失效，避免停用任务被旧快照重新注册。
        this.refreshVersion += 1
        const timer = this.timers.get(taskId)
        if (timer) clearTimeout(timer)
        this.timers.delete(taskId)
        this.bumpGeneration(taskId)
    }

    private async scheduleNext(taskId: string, generation: number): Promise<void> {
        if (!this.isCurrentGeneration(taskId, generation)) return
        let task: TbSkylineDatetaskSystem
        try {
            task = await this.repository.findOne({ where: { taskId } })
        } catch (error) {
            this.logger.error(`读取任务 ${taskId} 失败：${this.errorMessage(error)}`, undefined, DatetaskSchedulerService.name)
            this.scheduleRetry(taskId, generation)
            return
        }
        if (!this.isCurrentGeneration(taskId, generation)) return
        if (!task || !this.datetaskUtilsService.isSchedulable(task)) return

        let next: Date | undefined
        try {
            next = this.datetaskUtilsService.getNextRun(task.cron, new Date())
        } catch (error) {
            // 数据库中可能保留历史上的非法 Cron；不能让异步调度任务产生未处理拒绝。
            this.logger.error(`任务 ${taskId} 的 Cron 表达式无效：${this.errorMessage(error)}`, undefined, DatetaskSchedulerService.name)
            return
        }
        if (!next) {
            this.logger.warn(`任务 ${taskId} 没有可计算的下次执行时间`, DatetaskSchedulerService.name)
            return
        }
        const now = Date.now()
        const remaining = next.getTime() - now
        const requiresRecalculation = remaining > DATETASK_MAX_TIMER_DELAY_MS
        const delay = Math.max(100, Math.min(remaining, DATETASK_MAX_TIMER_DELAY_MS))
        await this.repository.update({ taskId }, { nextTime: next } as never).catch(error => {
            this.logger.warn(`更新任务 ${taskId} 下次执行时间失败：${this.errorMessage(error)}`, DatetaskSchedulerService.name)
        })
        if (!this.isCurrentGeneration(taskId, generation)) return
        const timer = setTimeout(() => {
            if (!this.isCurrentGeneration(taskId, generation) || this.timers.get(taskId) !== timer) return
            this.timers.delete(taskId)
            if (requiresRecalculation) {
                // Node.js 无法安全等待超过约 24.8 天；检查定时器到期后重新计算，绝不能提前执行任务。
                void this.scheduleNext(taskId, generation).catch(error => {
                    this.logger.error(
                        `任务 ${taskId} 长延时重新计算失败：${this.errorMessage(error)}`,
                        undefined,
                        DatetaskSchedulerService.name
                    )
                    this.scheduleRetry(taskId, generation)
                })
                return
            }
            void this.runAndReschedule(taskId, generation)
        }, delay)
        this.timers.set(taskId, timer)
    }

    private async runAndReschedule(taskId: string, generation: number): Promise<void> {
        try {
            await this.datetaskExecutorService.execute(taskId)
        } catch {
            // 执行器已记录详细错误；调度器继续保留下一周期任务。
        } finally {
            if (this.isCurrentGeneration(taskId, generation)) {
                try {
                    await this.scheduleNext(taskId, generation)
                } catch (error) {
                    // 兜底保护：调度器不能因为单个任务异常而产生未处理 Promise 拒绝。
                    this.logger.error(`任务 ${taskId} 重新调度失败：${this.errorMessage(error)}`, undefined, DatetaskSchedulerService.name)
                }
            }
        }
    }

    private bumpGeneration(taskId: string): number {
        const generation = (this.generations.get(taskId) ?? 0) + 1
        this.generations.set(taskId, generation)
        return generation
    }

    /** 清理当前任务定时器并使所有尚未完成的旧异步调度失效。 */
    private clearTaskTimers(): void {
        for (const timer of this.timers.values()) clearTimeout(timer)
        this.timers.clear()
        for (const taskId of [...this.generations.keys()]) this.bumpGeneration(taskId)
    }

    /** 清理系统任务列表刷新重试定时器。 */
    private clearRefreshRetry(): void {
        if (this.refreshRetryTimer) clearTimeout(this.refreshRetryTimer)
        this.refreshRetryTimer = undefined
    }

    /** 数据库恢复后自动重新读取任务列表，避免调度器永久停留在旧状态。 */
    private scheduleRefreshRetry(): void {
        if (this.refreshRetryTimer) return
        const timer = setTimeout(() => {
            if (this.refreshRetryTimer !== timer) return
            this.refreshRetryTimer = undefined
            void this.refresh(false).catch(error => {
                // refresh(false) 通常会自行处理读取异常；这里兜底处理替换阶段的异常，确保仍会重试。
                this.logger.error(`刷新系统任务重试失败：${this.errorMessage(error)}`, undefined, DatetaskSchedulerService.name)
                this.scheduleRefreshRetry()
            })
        }, DATETASK_SCHEDULER_RETRY_DELAY_MS)
        this.refreshRetryTimer = timer
    }

    /**
     * 数据库暂时不可用时延迟重试读取，避免一次网络抖动让任务永久退出调度。
     * 通过 generation 和 timer 身份双重校验，停用或重新配置任务后旧重试不会复活。
     */
    private scheduleRetry(taskId: string, generation: number): void {
        if (!this.isCurrentGeneration(taskId, generation) || this.timers.has(taskId)) return
        const timer = setTimeout(() => {
            if (!this.isCurrentGeneration(taskId, generation) || this.timers.get(taskId) !== timer) return
            this.timers.delete(taskId)
            void this.scheduleNext(taskId, generation).catch(error => {
                this.logger.error(`任务 ${taskId} 重试调度失败：${this.errorMessage(error)}`, undefined, DatetaskSchedulerService.name)
                this.scheduleRetry(taskId, generation)
            })
        }, DATETASK_SCHEDULER_RETRY_DELAY_MS)
        this.timers.set(taskId, timer)
    }

    private isCurrentGeneration(taskId: string, generation: number): boolean {
        return this.generations.get(taskId) === generation
    }

    private errorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error)
    }
}
