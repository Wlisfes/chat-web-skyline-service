import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataBaseService } from '@wlisfes/chat-web-base-schema/database'
import { PageResult } from '@wlisfes/chat-web-base-schema/utils'
import { isNotEmpty } from 'class-validator'
import { Repository } from 'typeorm'
import { DatetaskLogService } from '@/modules/datetask/datetask.log.service'
import { DatetaskExecutorService } from '@/modules/datetask/datetask.executor.service'
import { DatetaskSchedulerService } from '@/modules/datetask/datetask.scheduler.service'
import { DatetaskUtilsService, DatetaskRecord } from '@/modules/datetask/datetask.utils.service'
import * as DatetaskDto from '@/modules/datetask/dto/datetask.dto'
import { DatetaskManageStatus, DatetaskStatus } from '@/modules/datetask/datetask.constants'
import { TbSkylineDatetaskSystem } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'

/** 系统任务管理业务服务。 */
@Injectable()
export class DatetaskService {
    constructor(
        @InjectRepository(TbSkylineDatetaskSystem) private readonly repository: Repository<TbSkylineDatetaskSystem>,
        private readonly database: DataBaseService,
        private readonly datetaskUtilsService: DatetaskUtilsService,
        private readonly datetaskSchedulerService: DatetaskSchedulerService,
        private readonly datetaskExecutorService: DatetaskExecutorService,
        private readonly datetaskLogService: DatetaskLogService
    ) {}

    /** 系统任务分页列表。 */
    public async httpBaseSkylineColumnDatetask(input: DatetaskDto.ListDatetaskDto): Promise<PageResult<DatetaskDto.DatetaskResponseDto>> {
        const page = input.page ?? 1
        const size = input.size ?? 50
        return this.database.builder(this.repository, async qb => {
            const taskName = input.taskName?.trim()
            if (isNotEmpty(taskName)) qb.andWhere('t.taskName LIKE :taskName', { taskName: `%${taskName}%` })
            if (isNotEmpty(input.status)) qb.andWhere('t.status = :status', { status: input.status })
            qb.orderBy('t.createTime', 'DESC')
                .addOrderBy('t.keyId', 'DESC')
                .skip((page - 1) * size)
                .take(size)
            const [list, total] = await qb.getManyAndCount()
            return {
                page,
                size,
                total,
                list: list.map(task => this.datetaskUtilsService.toResponse(task) as DatetaskDto.DatetaskResponseDto)
            }
        })
    }

    /** 系统任务详情。 */
    public async httpBaseSkylineResolverDatetask(query: DatetaskDto.ResolveDatetaskDto): Promise<DatetaskDto.DatetaskResponseDto> {
        return this.datetaskUtilsService.toResponse(
            await this.datetaskUtilsService.findRequired(query.taskId)
        ) as DatetaskDto.DatetaskResponseDto
    }

    /** 启用或停用系统任务。 */
    public async httpBaseSkylineUpdateDatetaskStatus(input: DatetaskDto.UpdateDatetaskStatusDto): Promise<DatetaskDto.DatetaskResponseDto> {
        if (input.status !== DatetaskManageStatus.RUNNING && input.status !== DatetaskManageStatus.STOP) {
            throw new BadRequestException('系统任务只能设置为启用或停用')
        }
        const task = await this.repository.manager.transaction(async manager => {
            const current = await this.datetaskUtilsService.findRequired(input.taskId, manager, true)
            this.assertTaskMutable(current)
            await manager.update(TbSkylineDatetaskSystem, { taskId: current.taskId }, { status: input.status } as never)
            return current
        })
        if (input.status === DatetaskManageStatus.RUNNING) this.datetaskSchedulerService.schedule(task.taskId)
        else this.datetaskSchedulerService.unschedule(task.taskId)
        return this.httpBaseSkylineResolverDatetask({ taskId: task.taskId })
    }

    /** 修改系统任务 Cron 表达式。 */
    public async httpBaseSkylineUpdateDatetaskCron(input: DatetaskDto.UpdateDatetaskCronDto): Promise<DatetaskDto.DatetaskResponseDto> {
        const cron = this.datetaskUtilsService.normalizeCron(input.cron)
        const task = await this.repository.manager.transaction(async manager => {
            const current = await this.datetaskUtilsService.findRequired(input.taskId, manager, true)
            this.assertTaskMutable(current)
            await manager.update(TbSkylineDatetaskSystem, { taskId: current.taskId }, { cron } as never)
            return { ...current, cron }
        })
        if (this.datetaskUtilsService.isSchedulable({ ...task, cron })) this.datetaskSchedulerService.schedule(task.taskId)
        else this.datetaskSchedulerService.unschedule(task.taskId)
        return this.httpBaseSkylineResolverDatetask({ taskId: task.taskId })
    }

    /** 手动触发一次系统任务。 */
    public async httpBaseSkylineTriggerDatetask(
        input: DatetaskDto.TriggerDatetaskDto,
        authorization?: string
    ): Promise<DatetaskDto.TriggerDatetaskResponseDto> {
        const task = await this.datetaskUtilsService.findRequired(input.taskId)
        const result = await this.datetaskExecutorService.execute(task.taskId, authorization)
        return { success: true, result }
    }

    /** 查询系统任务最近执行日志。 */
    public async httpBaseSkylineColumnDatetaskLog(
        input: DatetaskDto.ListDatetaskLogDto
    ): Promise<PageResult<DatetaskDto.DatetaskLogResponseDto>> {
        await this.datetaskUtilsService.findRequired(input.taskId)
        return this.datetaskLogService.list(input)
    }

    /** 已完成的系统任务属于只读状态，不允许再调整调度配置。 */
    private assertTaskMutable(task: Pick<DatetaskRecord, 'status'>): void {
        if (task.status === DatetaskStatus.FINISH) {
            throw new BadRequestException('已完成任务不可修改')
        }
    }
}
