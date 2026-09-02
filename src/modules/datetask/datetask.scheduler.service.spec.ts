import { Logger } from '@nestjs/common'
import { TbSkylineDatetaskSystem, TbSkylineDatetaskSystemStatus } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { DatetaskSchedulerService } from './datetask.scheduler.service'
import { DATETASK_MAX_TIMER_DELAY_MS, DATETASK_SCHEDULER_RETRY_DELAY_MS } from './datetask.constants'

describe('DatetaskSchedulerService', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    function createService() {
        const task = {
            taskId: 'task-1',
            taskName: '测试任务',
            cron: '0 0 8 * * *',
            status: TbSkylineDatetaskSystemStatus.RUNNING
        } as TbSkylineDatetaskSystem
        const repository = {
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 1 })
        }
        const utils = {
            isSchedulable: jest.fn().mockReturnValue(true),
            getNextRun: jest.fn().mockReturnValue(new Date(Date.now() + 60_000))
        }
        const executor = { execute: jest.fn().mockResolvedValue(undefined) }
        const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as Logger
        const service = new DatetaskSchedulerService(repository as never, utils as never, executor as never, logger)
        return { service, task, repository, utils, executor, logger }
    }

    async function flushPromises(): Promise<void> {
        for (let index = 0; index < 5; index += 1) await Promise.resolve()
    }

    it('取消任务后不应让旧的异步查询重新注册定时器', async () => {
        const { service, task, repository } = createService()
        let resolve!: (value: TbSkylineDatetaskSystem) => void
        repository.findOne.mockReturnValueOnce(new Promise<TbSkylineDatetaskSystem>(currentResolve => (resolve = currentResolve)))

        service.schedule(task.taskId)
        service.unschedule(task.taskId)
        resolve(task)
        await flushPromises()

        expect(jest.getTimerCount()).toBe(0)
    })

    it('重新调度后旧查询不能覆盖新定时器', async () => {
        const { service, task, repository } = createService()
        let resolveOld!: (value: TbSkylineDatetaskSystem) => void
        repository.findOne
            .mockReturnValueOnce(new Promise<TbSkylineDatetaskSystem>(currentResolve => (resolveOld = currentResolve)))
            .mockResolvedValueOnce(task)

        service.schedule(task.taskId)
        service.schedule(task.taskId)
        await flushPromises()
        expect(jest.getTimerCount()).toBe(1)

        resolveOld(task)
        await flushPromises()

        expect(jest.getTimerCount()).toBe(1)
    })

    it('数据库中的非法 Cron 不应产生未处理 Promise 拒绝', async () => {
        const { service, task, repository, utils } = createService()
        repository.findOne.mockResolvedValueOnce(task)
        utils.getNextRun.mockImplementationOnce(() => {
            throw new Error('Cron表达式格式错误')
        })

        service.schedule(task.taskId)
        await flushPromises()

        expect(jest.getTimerCount()).toBe(0)
    })

    it('超过 Node 最大延时的任务只应重新计算且不能提前执行', async () => {
        const { service, task, repository, utils, executor } = createService()
        jest.setSystemTime(new Date('2026-09-03T00:00:00.000Z'))
        repository.findOne.mockResolvedValue(task)
        utils.getNextRun.mockImplementation(() => new Date(Date.now() + DATETASK_MAX_TIMER_DELAY_MS + 60_000))

        service.schedule(task.taskId)
        await flushPromises()
        expect(jest.getTimerCount()).toBe(1)

        await jest.advanceTimersByTimeAsync(DATETASK_MAX_TIMER_DELAY_MS)
        await flushPromises()

        expect(executor.execute).not.toHaveBeenCalled()
        expect(repository.findOne).toHaveBeenCalledTimes(2)
        expect(utils.getNextRun).toHaveBeenCalledTimes(2)
        expect(jest.getTimerCount()).toBe(1)
    })

    it('严格刷新时数据库读取失败应向上抛出', async () => {
        const { service, repository } = createService()
        repository.find.mockRejectedValueOnce(new Error('数据库暂不可用'))

        await expect(service.refresh(true)).rejects.toThrow('数据库暂不可用')
        expect(jest.getTimerCount()).toBe(0)
    })

    it('运行期间刷新读取失败应保留旧任务定时器并在恢复后替换调度', async () => {
        const { service, task, repository } = createService()
        repository.findOne.mockResolvedValue(task)

        service.schedule(task.taskId)
        await flushPromises()
        const oldTimer = (service as unknown as { timers: Map<string, NodeJS.Timeout> }).timers.get(task.taskId)
        expect(oldTimer).toBeDefined()
        expect(jest.getTimerCount()).toBe(1)

        repository.find.mockRejectedValueOnce(new Error('数据库暂不可用')).mockResolvedValueOnce([task])
        await service.refresh()

        // 刷新失败时不能先清空原有调度；另一个独立定时器负责稍后重试列表读取。
        expect((service as unknown as { timers: Map<string, NodeJS.Timeout> }).timers.get(task.taskId)).toBe(oldTimer)
        expect(jest.getTimerCount()).toBe(2)

        await jest.advanceTimersByTimeAsync(DATETASK_SCHEDULER_RETRY_DELAY_MS)
        await flushPromises()

        expect(repository.find).toHaveBeenCalledTimes(2)
        expect((service as unknown as { timers: Map<string, NodeJS.Timeout> }).timers.get(task.taskId)).not.toBe(oldTimer)
        expect(jest.getTimerCount()).toBe(1)
    })

    it('较早的刷新结果不应覆盖较新的刷新结果', async () => {
        const { service, task, repository } = createService()
        let resolveOld!: (value: TbSkylineDatetaskSystem[]) => void
        repository.find
            .mockReturnValueOnce(new Promise<TbSkylineDatetaskSystem[]>(resolve => (resolveOld = resolve)))
            .mockResolvedValueOnce([])

        const oldRefresh = service.refresh()
        await service.refresh()
        resolveOld([task])
        await Promise.all([oldRefresh, flushPromises()])

        expect(jest.getTimerCount()).toBe(0)
    })

    it('运行期间读取任务失败后应延迟重试并恢复下一次调度', async () => {
        const { service, task, repository } = createService()
        repository.findOne.mockRejectedValueOnce(new Error('数据库暂不可用')).mockResolvedValueOnce(task)

        service.schedule(task.taskId)
        await flushPromises()
        expect(repository.findOne).toHaveBeenCalledTimes(1)
        expect(jest.getTimerCount()).toBe(1)

        await jest.advanceTimersByTimeAsync(DATETASK_SCHEDULER_RETRY_DELAY_MS)
        await flushPromises()

        expect(repository.findOne).toHaveBeenCalledTimes(2)
        expect(jest.getTimerCount()).toBe(1)
    })

    it('停用任务后不应执行旧的数据库重试', async () => {
        const { service, task, repository } = createService()
        repository.findOne.mockRejectedValueOnce(new Error('数据库暂不可用'))

        service.schedule(task.taskId)
        await flushPromises()
        expect(jest.getTimerCount()).toBe(1)

        service.unschedule(task.taskId)
        await jest.advanceTimersByTimeAsync(DATETASK_SCHEDULER_RETRY_DELAY_MS)
        await flushPromises()

        expect(repository.findOne).toHaveBeenCalledTimes(1)
        expect(jest.getTimerCount()).toBe(0)
    })
})
