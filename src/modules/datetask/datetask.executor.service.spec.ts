import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common'
import { TbSkylineDatetaskSystem, TbSkylineDatetaskSystemStatus } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { CURRENCY_EXCHANGE_TASK_HANDLER, DatetaskLogStatus } from './datetask.constants'
import { DatetaskExecutorService } from './datetask.executor.service'
import { DatetaskLogService } from './datetask.log.service'

describe('DatetaskExecutorService', () => {
    function task(handler = CURRENCY_EXCHANGE_TASK_HANDLER): TbSkylineDatetaskSystem {
        return {
            taskId: '2149446185344106496',
            taskName: '汇率同步定时任务',
            handler,
            status: TbSkylineDatetaskSystemStatus.RUNNING,
            type: 'system',
            cron: '0 0 8 * * *'
        } as TbSkylineDatetaskSystem
    }

    function createService(currentTask = task()) {
        const manager = { update: jest.fn().mockResolvedValue({ affected: 1 }) }
        const queryRunner = {
            connect: jest.fn().mockResolvedValue(undefined),
            query: jest.fn().mockImplementation((sql: string) => {
                if (sql.includes('GET_LOCK')) return [{ acquired: 1 }]
                return [{ released: 1 }]
            }),
            release: jest.fn().mockResolvedValue(undefined),
            manager
        }
        const dataSource = { createQueryRunner: jest.fn().mockReturnValue(queryRunner) }
        const utils = { findRequired: jest.fn().mockResolvedValue(currentTask) }
        const logs = new DatetaskLogService()
        const currency = { execute: jest.fn().mockResolvedValue({ date: '2026-09-02', count: 30 }) }
        const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger
        const service = new DatetaskExecutorService(dataSource as never, utils as never, logs, currency as never, logger)
        return { service, manager, utils, logs, currency, dataSource, queryRunner, logger }
    }

    it('应执行汇率处理器、更新时间并记录成功日志', async () => {
        const { service, manager, utils, logs, currency, queryRunner } = createService()

        await expect(service.execute('2149446185344106496')).resolves.toEqual({ date: '2026-09-02', count: 30 })
        expect(currency.execute).toHaveBeenCalledWith()
        expect(manager.update).toHaveBeenCalledWith(
            TbSkylineDatetaskSystem,
            { taskId: '2149446185344106496' },
            expect.objectContaining({ lastTime: expect.any(Date) })
        )
        expect(logs.list({ taskId: '2149446185344106496', page: 1, size: 10 }).list[0]).toEqual(
            expect.objectContaining({ status: DatetaskLogStatus.SUCCESS })
        )
        expect(logs.list({ taskId: '2149446185344106496', page: 1, size: 10 }).total).toBe(1)
        expect(service.isRunning('2149446185344106496')).toBe(false)
        expect(utils.findRequired).toHaveBeenCalledWith('2149446185344106496', queryRunner.manager, false)
    })

    it('停用任务应跳过执行且不写入日志', async () => {
        const stopped = task()
        stopped.status = TbSkylineDatetaskSystemStatus.STOP
        const { service, currency, logs } = createService(stopped)

        await expect(service.execute(stopped.taskId)).resolves.toEqual({ skipped: true, reason: '任务已停用' })
        expect(currency.execute).not.toHaveBeenCalled()
        expect(logs.list({ taskId: stopped.taskId, page: 1, size: 10 }).total).toBe(0)
    })

    it('已完成任务应跳过执行且不写入日志', async () => {
        const finished = task()
        finished.status = TbSkylineDatetaskSystemStatus.FINISH
        const { service, currency, logs } = createService(finished)

        await expect(service.execute(finished.taskId)).resolves.toEqual({ skipped: true, reason: '任务已完成' })
        expect(currency.execute).not.toHaveBeenCalled()
        expect(logs.list({ taskId: finished.taskId, page: 1, size: 10 }).total).toBe(0)
    })

    it('未知处理器应记录失败日志并抛出业务异常', async () => {
        const { service, logs } = createService(task('unknown-handler'))

        await expect(service.execute('2149446185344106496')).rejects.toBeInstanceOf(BadRequestException)
        expect(logs.list({ taskId: '2149446185344106496', page: 1, size: 10 }).list[0]).toEqual(
            expect.objectContaining({ status: DatetaskLogStatus.FAILED, result: { message: '未注册的任务处理器：unknown-handler' } })
        )
    })

    it('同一任务执行期间再次触发应返回跳过结果', async () => {
        let release!: () => void
        const pending = new Promise(resolve => {
            release = () => resolve({ date: '2026-09-02', count: 1 })
        })
        const { service, currency } = createService()
        currency.execute.mockReturnValueOnce(pending)

        const first = service.execute('2149446185344106496')
        await Promise.resolve()
        await expect(service.execute('2149446185344106496')).resolves.toEqual({ skipped: true, reason: '任务正在执行' })
        release()
        await first
    })

    it('MySQL 会话锁被其他 Pod 持有时应跳过执行', async () => {
        const { service, queryRunner, currency } = createService()
        queryRunner.query.mockImplementation((sql: string) => (sql.includes('GET_LOCK') ? [{ acquired: 0 }] : [{ released: 1 }]))

        await expect(service.execute('2149446185344106496')).resolves.toEqual({ skipped: true, reason: '任务正在其他实例执行' })
        expect(currency.execute).not.toHaveBeenCalled()
        expect(queryRunner.release).toHaveBeenCalledTimes(1)
    })

    it.each([null, undefined, '', 'invalid', 2, Number.NaN])('GET_LOCK 返回 %p 时应报告锁调用异常并释放连接', async acquired => {
        const { service, queryRunner, currency } = createService()
        queryRunner.query.mockImplementation((sql: string) => (sql.includes('GET_LOCK') ? [{ acquired }] : [{ released: 1 }]))

        const execution = service.execute('2149446185344106496')
        await expect(execution).rejects.toBeInstanceOf(ServiceUnavailableException)
        await expect(execution).rejects.toThrow('获取系统任务分布式锁失败')
        expect(currency.execute).not.toHaveBeenCalled()
        expect(queryRunner.release).toHaveBeenCalledTimes(1)
    })
})
