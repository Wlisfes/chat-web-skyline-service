import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DatetaskLogStatus, DatetaskLogTrigger } from '@/modules/datetask/datetask.constants'
import { InjectRepository, Repository } from '@wlisfes/chat-web-base-schema/database'
import { PageResult, isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
import * as DatetaskDto from '@/modules/datetask/dto/datetask.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'
import * as feign from '@wlisfes/chat-web-base-schema/feign'

/** 单次执行的触发上下文；缺省时视为系统调度执行，触发人为系统账号。 */
export interface DatetaskTriggerContext {
    /**触发方式**/
    triggerType: DatetaskLogTrigger
    /**触发人 UID**/
    uid: string
}

/** 系统调度执行的默认触发上下文。 */
export const DATETASK_SYSTEM_TRIGGER: DatetaskTriggerContext = { triggerType: DatetaskLogTrigger.SYSTEM, uid: feign.ACCOUNT_SYSTEM_UID }

/** 完成一次执行时需要写入的日志内容。 */
export interface DatetaskLogCompleteInput {
    taskId: string
    taskName?: string
    status: DatetaskLogStatus
    duration: number
    startTime: Date
    endTime: Date
    result?: DatetaskDto.DatetaskExecutionResultDto
    trigger?: DatetaskTriggerContext
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

    constructor(
        @InjectRepository(Schema.TbSkylineDatetaskLog) private readonly repository: Repository<Schema.TbSkylineDatetaskLog>,
        private readonly accountFeignClient: feign.FeignClientAccountManager,
        private readonly configService: ConfigService
    ) {}

    /** 生成单次执行的唯一标识。 */
    public createExecutionId(taskId: string): string {
        this.executionSequence = (this.executionSequence + 1) % 1_000_000
        return `${taskId}:${Date.now()}:${this.executionSequence}`
    }

    /** 写入执行中的占位日志。 */
    public async appendRunning(
        executionId: string,
        taskId: string,
        startTime: Date,
        taskName?: string,
        trigger: DatetaskTriggerContext = DATETASK_SYSTEM_TRIGGER
    ): Promise<void> {
        await this.repository.insert({
            executionId,
            taskId,
            taskName,
            status: DatetaskLogStatus.RUNNING,
            triggerType: trigger.triggerType,
            duration: 0,
            startTime,
            createBy: trigger.uid,
            modifyBy: trigger.uid
        })
    }

    /** 将执行中的占位日志更新为最终结果；占位记录写入失败时补写一条完整记录。 */
    public async complete(executionId: string, record: DatetaskLogCompleteInput): Promise<void> {
        const values = {
            taskName: record.taskName,
            status: record.status,
            duration: record.duration,
            endTime: record.endTime,
            // 执行结果以 JSON 存储，实体字段类型为通用对象。
            result: (record.result ?? null) as Record<string, unknown>
        }
        const updated = await this.repository.update({ executionId }, values)
        if (updated.affected) {
            return
        }
        const trigger = record.trigger ?? DATETASK_SYSTEM_TRIGGER
        await this.repository.insert({
            ...values,
            executionId,
            taskId: record.taskId,
            startTime: record.startTime,
            triggerType: trigger.triggerType,
            createBy: trigger.uid,
            modifyBy: trigger.uid
        })
    }

    /** 查询任务执行日志分页数据，按开始时间倒序。 */
    public async list(input: DatetaskDto.ListDatetaskLogDto): Promise<PageResult<DatetaskDto.DatetaskLogResponseDto>> {
        const page = input.page ?? 1
        const size = input.size ?? 50
        const where = isNotEmpty(input.status) ? { taskId: input.taskId, status: input.status } : { taskId: input.taskId }
        const [rows, total] = await this.repository.findAndCount({
            where: where,
            order: { startTime: 'DESC', keyId: 'DESC' },
            skip: (page - 1) * size,
            take: size
        })
        // 触发人姓名属于展示元数据，使用服务间凭据按列表批量还原。
        const list = await feign.appendAccountUserOptions(this.accountFeignClient, this.configService, rows, ['createBy'])
        return { page, size, total, list }
    }
}
