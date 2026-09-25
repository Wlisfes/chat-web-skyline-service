import { Injectable } from '@nestjs/common'
import { DatetaskLogStatus } from '@/modules/datetask/datetask.constants'
import * as DatetaskDto from '@/modules/datetask/dto/datetask.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'

import { InjectRepository, Repository } from '@wlisfes/chat-web-base-schema/database'
import { PageResult, isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
/** 完成一次执行时需要写入的日志内容。 */
export interface DatetaskLogCompleteInput {
    taskId: string
    taskName?: string
    status: DatetaskLogStatus
    duration: number
    startTime: Date
    endTime: Date
    result?: DatetaskDto.DatetaskExecutionResultDto
}

/**
 * 任务执行日志存储。
 *
 * 日志持久化到 tb_skyline_datetask_log，服务重启后不丢失且多实例共享；
 * 每次执行以 executionId 唯一标识，开始时写入执行中记录，结束时原地更新为最终结果。
 */
@Injectable()
export class DatetaskLogService {
    private executionSequence = 0

    constructor(@InjectRepository(Schema.TbSkylineDatetaskLog) private readonly repository: Repository<Schema.TbSkylineDatetaskLog>) {}

    /** 生成单次执行的唯一标识。 */
    public createExecutionId(taskId: string): string {
        this.executionSequence = (this.executionSequence + 1) % 1_000_000
        return `${taskId}:${Date.now()}:${this.executionSequence}`
    }

    /** 写入执行中的占位日志。 */
    public async appendRunning(executionId: string, taskId: string, startTime: Date, taskName?: string): Promise<void> {
        await this.repository.insert({
            executionId,
            taskId,
            taskName,
            status: DatetaskLogStatus.RUNNING,
            duration: 0,
            startTime
        } as never)
    }

    /** 将执行中的占位日志更新为最终结果；占位记录写入失败时补写一条完整记录。 */
    public async complete(executionId: string, record: DatetaskLogCompleteInput): Promise<void> {
        const values = {
            taskName: record.taskName,
            status: record.status,
            duration: record.duration,
            endTime: record.endTime,
            result: record.result ?? null
        }
        const updated = await this.repository.update({ executionId }, values as never)
        if (updated.affected) return
        await this.repository.insert({ ...values, executionId, taskId: record.taskId, startTime: record.startTime } as never)
    }

    /** 查询任务执行日志分页数据，按开始时间倒序。 */
    public async list(input: DatetaskDto.ListDatetaskLogDto): Promise<PageResult<DatetaskDto.DatetaskLogResponseDto>> {
        const page = input.page ?? 1
        const size = input.size ?? 50
        const where = isNotEmpty(input.status) ? { taskId: input.taskId, status: input.status } : { taskId: input.taskId }
        const [rows, total] = await this.repository.findAndCount({
            where: where as never,
            order: { startTime: 'DESC', keyId: 'DESC' } as never,
            skip: (page - 1) * size,
            take: size
        })
        return {
            page,
            size,
            total,
            list: rows.map(row => ({
                keyId: row.executionId,
                taskId: row.taskId,
                status: row.status as unknown as DatetaskLogStatus,
                duration: row.duration,
                startTime: row.startTime as unknown as string,
                endTime: (row.endTime as unknown as string) ?? undefined,
                result: (row.result as DatetaskDto.DatetaskExecutionResultDto) ?? undefined
            }))
        }
    }
}
