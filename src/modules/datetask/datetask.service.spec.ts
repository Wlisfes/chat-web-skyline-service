import { BadRequestException } from '@nestjs/common'
import { TbSkylineDatetaskSystem, TbSkylineDatetaskSystemStatus } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { DatetaskLogStatus, DatetaskManageStatus, DatetaskStatus } from './datetask.constants'
import { DatetaskService } from './datetask.service'

describe('DatetaskService', () => {
    const baseTask = {
        keyId: 1,
        taskId: '2149446185344106496',
        taskName: '汇率同步定时任务',
        handler: 'datetask-sync-exchange-rate',
        comment: '说明',
        cron: '0 0 8 * * *',
        type: 'system',
        status: TbSkylineDatetaskSystemStatus.RUNNING,
        body: { base: 'USD' }
    } as unknown as TbSkylineDatetaskSystem

    function createService() {
        const queryBuilder = {
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            addOrderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([[baseTask], 1])
        }
        const manager = { update: jest.fn().mockResolvedValue({ affected: 1 }) }
        const repository = {
            createQueryBuilder: jest.fn(),
            manager: {
                transaction: jest.fn(async (callback: (manager: unknown) => unknown) => callback(manager))
            }
        }
        const database = {
            builder: jest.fn(async (_model: unknown, callback: (queryBuilder: unknown) => unknown) => callback(queryBuilder))
        }
        const utils = {
            findRequired: jest.fn().mockResolvedValue(baseTask),
            toResponse: jest.fn(task => ({ ...task, response: true })),
            normalizeCron: jest.fn(value => value.trim()),
            isSchedulable: jest.fn().mockReturnValue(true)
        }
        const scheduler = { schedule: jest.fn(), unschedule: jest.fn() }
        const executor = { execute: jest.fn().mockResolvedValue({ count: 30 }) }
        const logs = { list: jest.fn().mockReturnValue({ page: 1, size: 10, total: 0, list: [] }) }
        const service = new DatetaskService(
            repository as never,
            database as never,
            utils as never,
            scheduler as never,
            executor as never,
            logs as never
        )
        return { service, queryBuilder, repository, manager, database, utils, scheduler, executor, logs }
    }

    it('应使用统一 QueryBuilder 返回任务分页数据', async () => {
        const { service, queryBuilder } = createService()

        await expect(service.httpBaseSkylineColumnDatetask({ page: 2, size: 10, taskName: '汇率' })).resolves.toEqual({
            page: 2,
            size: 10,
            total: 1,
            list: [expect.objectContaining({ taskId: baseTask.taskId, response: true })]
        })
        expect(queryBuilder.andWhere).toHaveBeenCalledWith('t.taskName LIKE :taskName', { taskName: '%汇率%' })
        expect(queryBuilder.skip).toHaveBeenCalledWith(10)
        expect(queryBuilder.take).toHaveBeenCalledWith(10)
    })

    it('非法任务状态应拒绝更新', async () => {
        const { service, repository } = createService()

        await expect(
            service.httpBaseSkylineUpdateDatetaskStatus({ taskId: baseTask.taskId, status: TbSkylineDatetaskSystemStatus.FINISH as never })
        ).rejects.toBeInstanceOf(BadRequestException)
        expect(repository.manager.transaction).not.toHaveBeenCalled()
    })

    it('启停任务应在事务后同步调度器', async () => {
        const { service, manager, scheduler, utils } = createService()

        await service.httpBaseSkylineUpdateDatetaskStatus({ taskId: baseTask.taskId, status: DatetaskManageStatus.STOP })
        expect(manager.update).toHaveBeenCalledWith(TbSkylineDatetaskSystem, { taskId: baseTask.taskId }, { status: DatetaskStatus.STOP })
        expect(scheduler.unschedule).toHaveBeenCalledWith(baseTask.taskId)
        expect(utils.findRequired).toHaveBeenCalled()

        await service.httpBaseSkylineUpdateDatetaskStatus({ taskId: baseTask.taskId, status: DatetaskManageStatus.RUNNING })
        expect(scheduler.schedule).toHaveBeenCalledWith(baseTask.taskId)
    })

    it('已完成任务不可通过状态接口修改', async () => {
        const { service, manager, scheduler, utils, repository } = createService()
        utils.findRequired.mockResolvedValue({ ...baseTask, status: TbSkylineDatetaskSystemStatus.FINISH })

        await expect(
            service.httpBaseSkylineUpdateDatetaskStatus({ taskId: baseTask.taskId, status: DatetaskManageStatus.STOP })
        ).rejects.toThrow('已完成任务不可修改')
        expect(manager.update).not.toHaveBeenCalled()
        expect(scheduler.unschedule).not.toHaveBeenCalled()
        expect(scheduler.schedule).not.toHaveBeenCalled()
        expect(repository.manager.transaction).toHaveBeenCalledTimes(1)
    })

    it('已完成任务不可通过 Cron 接口修改', async () => {
        const { service, manager, scheduler, utils } = createService()
        utils.findRequired.mockResolvedValue({ ...baseTask, status: TbSkylineDatetaskSystemStatus.FINISH })

        await expect(service.httpBaseSkylineUpdateDatetaskCron({ taskId: baseTask.taskId, cron: '0 1 8 * * *' })).rejects.toThrow(
            '已完成任务不可修改'
        )
        expect(manager.update).not.toHaveBeenCalled()
        expect(scheduler.schedule).not.toHaveBeenCalled()
        expect(scheduler.unschedule).not.toHaveBeenCalled()
    })

    it('修改 Cron、手动触发和日志查询应委托对应组件', async () => {
        const { service, manager, scheduler, executor, logs, utils } = createService()

        await service.httpBaseSkylineUpdateDatetaskCron({ taskId: baseTask.taskId, cron: '0 1 8 * * *' })
        expect(utils.normalizeCron).toHaveBeenCalledWith('0 1 8 * * *')
        expect(manager.update).toHaveBeenCalledWith(TbSkylineDatetaskSystem, { taskId: baseTask.taskId }, { cron: '0 1 8 * * *' })
        expect(scheduler.schedule).toHaveBeenCalledWith(baseTask.taskId)

        await expect(service.httpBaseSkylineTriggerDatetask({ taskId: baseTask.taskId }, 'Bearer token')).resolves.toEqual({
            success: true,
            result: { count: 30 }
        })
        expect(executor.execute).toHaveBeenCalledWith(baseTask.taskId, 'Bearer token')

        const input = { taskId: baseTask.taskId, page: 1, size: 10, status: DatetaskLogStatus.SUCCESS }
        await expect(service.httpBaseSkylineColumnDatetaskLog(input)).resolves.toEqual({ page: 1, size: 10, total: 0, list: [] })
        expect(logs.list).toHaveBeenCalledWith(input)
    })
})
