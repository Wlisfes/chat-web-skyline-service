import { Logger } from '@nestjs/common'
import { Repository } from 'typeorm'
import { TbSkylineDatetaskSystem } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { DatetaskInitializerService } from '@/modules/datetask/datetask.initializer.service'
import { DatetaskSchedulerService } from '@/modules/datetask/datetask.scheduler.service'
import { SYSTEM_TASK_DEFINITIONS } from '@/modules/datetask/datetask.constants'

describe('DatetaskInitializerService', () => {
    it('应同步已有内置任务的系统元数据并保留人工调度配置', async () => {
        const definition = SYSTEM_TASK_DEFINITIONS[0]
        const existing = {
            ...definition,
            comment: '每天从 Frankfurter 获取汇率并通过 Finance 服务写入数据库',
            body: { base: 'USD' },
            cron: '0 30 9 * * *',
            status: 'stop',
            lastTime: new Date('2026-09-06T12:00:00.000Z')
        } as unknown as TbSkylineDatetaskSystem
        const repository = {
            findOne: jest.fn().mockResolvedValue(existing),
            merge: jest.fn((target, values) => Object.assign(target, values)),
            save: jest.fn().mockImplementation(value => Promise.resolve(value))
        } as unknown as Repository<TbSkylineDatetaskSystem>
        const scheduler = { refresh: jest.fn().mockResolvedValue(undefined) } as unknown as DatetaskSchedulerService
        const logger = { log: jest.fn() } as unknown as Logger
        const service = new DatetaskInitializerService(repository, scheduler, logger)

        await service.onModuleInit()

        expect(repository.merge).toHaveBeenCalledWith(existing, {
            taskName: definition.taskName,
            handler: definition.handler,
            comment: definition.comment,
            type: definition.type,
            body: {}
        })
        expect(repository.save).toHaveBeenCalledWith(existing)
        expect(existing.cron).toBe('0 30 9 * * *')
        expect(existing.status).toBe('stop')
        expect(existing.lastTime).toEqual(new Date('2026-09-06T12:00:00.000Z'))
        expect(scheduler.refresh).toHaveBeenCalledWith(true)
    })

    it('内置任务元数据未变化时不应产生无意义写入', async () => {
        const definition = SYSTEM_TASK_DEFINITIONS[0]
        const repository = {
            findOne: jest.fn().mockResolvedValue({ ...definition, body: {} }),
            merge: jest.fn(),
            save: jest.fn()
        } as unknown as Repository<TbSkylineDatetaskSystem>
        const scheduler = { refresh: jest.fn().mockResolvedValue(undefined) } as unknown as DatetaskSchedulerService
        const service = new DatetaskInitializerService(repository, scheduler, { log: jest.fn() } as unknown as Logger)

        await service.onModuleInit()

        expect(repository.merge).not.toHaveBeenCalled()
        expect(repository.save).not.toHaveBeenCalled()
        expect(scheduler.refresh).toHaveBeenCalledWith(true)
    })
})
