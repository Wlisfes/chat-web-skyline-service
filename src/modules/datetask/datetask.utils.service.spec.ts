import { BadRequestException, NotFoundException } from '@nestjs/common'
import { TbSkylineDatetaskSystem, TbSkylineDatetaskSystemStatus } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { DatetaskUtilsService } from './datetask.utils.service'

describe('DatetaskUtilsService', () => {
    function createService() {
        const repository = {
            createQueryBuilder: jest.fn()
        }
        const queryBuilder = {
            where: jest.fn().mockReturnThis(),
            setLock: jest.fn().mockReturnThis(),
            getOne: jest.fn()
        }
        const database = {
            builder: jest.fn(async (_model: unknown, callback: (queryBuilder: unknown) => unknown) => callback(queryBuilder))
        }
        return {
            service: new DatetaskUtilsService(repository as never, database as never),
            repository,
            database,
            queryBuilder
        }
    }

    it('应规范五段和六段 Cron 表达式', () => {
        const { service } = createService()

        expect(service.normalizeCron(' 0 8 * * * ')).toBe('0 8 * * *')
        expect(service.normalizeCron('*/10 0 8 * * 1-5')).toBe('*/10 0 8 * * 1-5')
    })

    it('非法 Cron 应抛出中文校验异常', () => {
        const { service } = createService()

        expect(() => service.normalizeCron('')).toThrow(BadRequestException)
        expect(() => service.normalizeCron('* * *')).toThrow('Cron表达式必须包含5段或6段')
        expect(() => service.normalizeCron('61 0 8 * * *')).toThrow('Cron表达式第1段格式错误')
    })

    it('应计算下一次触发时间并处理周末日历语义', () => {
        const { service } = createService()
        const from = new Date(2026, 8, 2, 7, 59, 59, 500)
        const next = service.getNextRun('0 0 8 * * *', from)

        expect(next).toEqual(new Date(2026, 8, 2, 8, 0, 0, 0))
        expect(service.getNextRun('0 0 8 * * *', new Date(2026, 8, 2, 8, 0, 0, 999))).toEqual(new Date(2026, 8, 3, 8, 0, 0, 0))
        expect(service.getNextRun('0 0 8 * * 1-5', new Date(2026, 8, 5, 9, 0, 0))).toEqual(new Date(2026, 8, 7, 8, 0, 0))
        // Cron 的 `7` 与 `0` 都表示星期日；单值 7 不能被误解析成整周。
        expect(service.getNextRun('0 0 8 * * 7', new Date(2026, 8, 5, 9, 0, 0))).toEqual(new Date(2026, 8, 6, 8, 0, 0))
    })

    it('应通过公共 DataBaseService 查找任务并在不存在时报错', async () => {
        const { service, database, queryBuilder } = createService()
        const task = { taskId: '1', status: TbSkylineDatetaskSystemStatus.RUNNING } as TbSkylineDatetaskSystem
        queryBuilder.getOne.mockResolvedValue(task)
        database.builder.mockImplementationOnce(async (_model: unknown, callback: (queryBuilder: unknown) => unknown) =>
            callback(queryBuilder)
        )

        await expect(service.findRequired('1')).resolves.toMatchObject(task)
        expect(queryBuilder.where).toHaveBeenCalledWith('t.taskId = :taskId', { taskId: '1' })

        database.builder.mockImplementationOnce(async (_model: unknown, callback: (queryBuilder: unknown) => unknown) =>
            callback({ ...queryBuilder, getOne: jest.fn().mockResolvedValue(undefined) })
        )
        await expect(service.findRequired('1')).rejects.toBeInstanceOf(NotFoundException)
        await expect(service.findRequired('')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('只允许运行中或等待中的任务进入调度器', () => {
        const { service } = createService()

        expect(service.isSchedulable({ cron: '0 0 8 * * *', status: TbSkylineDatetaskSystemStatus.RUNNING })).toBe(true)
        expect(service.isSchedulable({ cron: '0 0 8 * * *', status: TbSkylineDatetaskSystemStatus.STOP })).toBe(false)
        expect(service.isSchedulable({ cron: '', status: TbSkylineDatetaskSystemStatus.RUNNING })).toBe(false)
    })
})
