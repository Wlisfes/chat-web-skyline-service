import { DatetaskLogStatus } from './datetask.constants'
import { DatetaskLogService } from './datetask.log.service'

describe('DatetaskLogService', () => {
    it('应按最新优先保存并分页过滤执行日志', () => {
        const service = new DatetaskLogService()
        for (let index = 0; index < 205; index += 1) {
            service.append({
                taskId: 'task-1',
                status: index % 2 ? DatetaskLogStatus.FAILED : DatetaskLogStatus.SUCCESS,
                duration: index,
                startTime: `2026-09-02 08:00:${String(index).padStart(2, '0')}`,
                result: { message: `执行序号 ${index}` }
            })
        }

        const page = service.list({ taskId: 'task-1', page: 2, size: 10, status: DatetaskLogStatus.SUCCESS })
        expect(page.total).toBe(100)
        expect(page.list).toHaveLength(10)
        expect(page.list.every(item => item.status === DatetaskLogStatus.SUCCESS)).toBe(true)
        expect(page.list.every(item => typeof item.keyId === 'string')).toBe(true)
        expect(new Set(page.list.map(item => item.keyId)).size).toBe(page.list.length)
        expect(page.list[0]).not.toHaveProperty('createdAt')
    })

    it('应支持运行中占位记录和按任务清理', () => {
        const service = new DatetaskLogService()
        const executionId = service.appendRunning('task-2', new Date('2026-09-02T00:00:00.000Z'), '任务二')

        expect(service.list({ taskId: 'task-2', page: 1, size: 10 }).list).toEqual([
            expect.objectContaining({ keyId: executionId, taskId: 'task-2', status: DatetaskLogStatus.RUNNING, duration: 0 })
        ])
        service.complete(executionId, {
            taskId: 'task-2',
            status: DatetaskLogStatus.SUCCESS,
            duration: 120,
            startTime: '2026-09-02 08:00:00.000',
            endTime: '2026-09-02 08:00:00.120',
            result: { count: 1 },
            taskName: '任务二'
        })
        expect(service.list({ taskId: 'task-2', page: 1, size: 10 })).toEqual({
            page: 1,
            size: 10,
            total: 1,
            list: [expect.objectContaining({ keyId: executionId, status: DatetaskLogStatus.SUCCESS, duration: 120 })]
        })
        service.clear('task-2')
        expect(service.list({ taskId: 'task-2', page: 1, size: 10 }).total).toBe(0)
    })
})
