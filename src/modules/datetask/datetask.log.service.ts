import { Injectable } from '@nestjs/common'
import { isNotEmpty } from 'class-validator'
import { DATETASK_LOG_LIMIT, DatetaskLogStatus } from '@/modules/datetask/datetask.constants'
import { DatetaskLogResponseDto, ListDatetaskLogDto } from '@/modules/datetask/dto/datetask.dto'

type DatetaskLogRecord = Omit<DatetaskLogResponseDto, 'keyId'> & {
    taskName?: string
    createdAt: number
    executionId: string
}

type DatetaskLogInput = Omit<DatetaskLogRecord, 'createdAt' | 'executionId'> & {
    executionId?: string
}

/**
 * 任务执行日志存储。
 *
 * 当前 Skyline Schema 只包含任务定义表，执行日志先在进程内保留最近记录；
 * 通过独立服务封装，后续增加日志表时不会改变 Controller 与任务执行器契约。
 */
@Injectable()
export class DatetaskLogService {
    private readonly records = new Map<string, DatetaskLogRecord[]>()
    private executionSequence = 0

    /** 写入一次任务执行结果。 */
    public append(record: DatetaskLogInput): void {
        this.appendRecord(record)
    }

    /** 更新同一次执行的占位日志，避免运行中记录永久残留。 */
    public complete(executionId: string, record: Omit<DatetaskLogRecord, 'createdAt' | 'executionId'>): void {
        const list = this.records.get(record.taskId) ?? []
        const index = list.findIndex(item => item.executionId === executionId)
        if (index < 0) {
            // 占位记录可能已因保留上限被淘汰；即使重新追加，也必须保留原执行 ID，
            // 这样前端行键和一次执行的关联不会在完成阶段发生变化。
            this.appendRecord({ ...record, executionId })
            return
        }

        list[index] = { ...record, createdAt: list[index].createdAt, executionId }
        this.records.set(record.taskId, list)
    }

    private appendRecord(record: DatetaskLogInput): string {
        const list = this.records.get(record.taskId) ?? []
        const executionId = record.executionId ?? this.createExecutionId(record.taskId)
        list.unshift({ ...record, createdAt: Date.now(), executionId })
        this.records.set(record.taskId, list.slice(0, DATETASK_LOG_LIMIT))
        return executionId
    }

    /** 查询任务执行日志分页数据。 */
    public list(input: ListDatetaskLogDto): { page: number; size: number; total: number; list: DatetaskLogResponseDto[] } {
        const page = input.page ?? 1
        const size = input.size ?? 50
        const source = this.records.get(input.taskId) ?? []
        const filtered = isNotEmpty(input.status) ? source.filter(item => item.status === input.status) : source
        const start = (page - 1) * size
        return {
            page,
            size,
            total: filtered.length,
            list: filtered
                .slice(start, start + size)
                .map(({ createdAt, taskName, executionId, ...item }) => ({ ...item, keyId: executionId }))
        }
    }

    /** 清理某个任务的日志，主要用于测试和任务删除兼容。 */
    public clear(taskId: string): void {
        this.records.delete(taskId)
    }

    /** 生成执行中的占位日志。 */
    public appendRunning(taskId: string, startTime: Date, taskName?: string): string {
        return this.appendRecord({
            taskId,
            status: DatetaskLogStatus.RUNNING,
            duration: 0,
            startTime: this.formatDate(startTime),
            taskName
        })
    }

    private createExecutionId(taskId: string): string {
        return `${taskId}:${Date.now()}:${++this.executionSequence}`
    }

    private formatDate(value: Date): string {
        return value.toISOString().replace('T', ' ').replace('Z', '')
    }
}
