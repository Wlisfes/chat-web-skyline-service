import { BadRequestException, Injectable } from '@nestjs/common'
import { type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { DatetaskLogService } from '@/modules/datetask/datetask.log.service'
import { DatetaskExecutorService } from '@/modules/datetask/datetask.executor.service'
import { DatetaskSchedulerService } from '@/modules/datetask/datetask.scheduler.service'
import { DatetaskUtilsService, DatetaskRecord } from '@/modules/datetask/datetask.utils.service'
import { InjectRepository, DataBaseService, Repository } from '@wlisfes/chat-web-base-schema/database'
import { PageResult, isNotEmpty, fetchUntiePagination } from '@wlisfes/chat-web-base-schema/utils'
import * as DatetaskDto from '@/modules/datetask/dto/datetask.dto'
import * as DatetaskConstants from '@/modules/datetask/datetask.constants'
import * as Schema from '@wlisfes/chat-web-base-schema'

/** 系统任务管理业务服务。 */
@Injectable()
export class DatetaskService {
    constructor(
        @InjectRepository(Schema.TbSkylineDatetaskSystem) private readonly repository: Repository<Schema.TbSkylineDatetaskSystem>,
        private readonly database: DataBaseService,
        private readonly datetaskUtilsService: DatetaskUtilsService,
        private readonly datetaskSchedulerService: DatetaskSchedulerService,
        private readonly datetaskExecutorService: DatetaskExecutorService,
        private readonly datetaskLogService: DatetaskLogService
    ) {}

    /** 系统任务静态枚举。 */
    public async httpBaseSkylineDatetaskEnums(): Promise<DatetaskDto.DatetaskEnumsResponseDto> {
        return {
            typeOptions: Schema.TbSkylineDatetaskSystemTypeDefinition.options,
            statusOptions: Schema.TbSkylineDatetaskSystemStatusDefinition.options,
            manageStatusOptions: DatetaskConstants.DATETASK_MANAGE_STATUS_OPTIONS,
            logStatusOptions: DatetaskConstants.DatetaskLogStatusDefinition.options,
            triggerTypeOptions: DatetaskConstants.DatetaskLogTriggerDefinition.options
        }
    }

    /** 系统任务分页列表。 */
    public async httpBaseSkylineColumnDatetask(input: DatetaskDto.ListDatetaskDto): Promise<PageResult<DatetaskDto.DatetaskResponseDto>> {
        const { page, size } = fetchUntiePagination(input)
        return this.database.builder(this.repository, async qb => {
            qb.andWhere('t.type = :type', { type: input.type })
            if (isNotEmpty(input.taskName?.trim())) {
                qb.andWhere('t.taskName LIKE :taskName', { taskName: `%${input.taskName?.trim()}%` })
            }
            if (isNotEmpty(input.status)) {
                qb.andWhere('t.status = :status', { status: input.status })
            }
            qb.orderBy('t.createTime', 'DESC')
            qb.addOrderBy('t.keyId', 'DESC')
            qb.skip((page - 1) * size)
            qb.take(size)
            return await qb.getManyAndCount().then(async ([list, total]) => {
                return { page, size, total, list: await this.datetaskUtilsService.toResponse(list) }
            })
        })
    }

    /** 系统任务详情。 */
    public async httpBaseSkylineResolverDatetask(query: DatetaskDto.ResolveDatetaskDto): Promise<DatetaskDto.DatetaskResponseDto> {
        return await this.datetaskUtilsService.toResponse([await this.datetaskUtilsService.findRequired(query.taskId)]).then(([task]) => {
            return task
        })
    }

    /** 启用或停用系统任务。 */
    public async httpBaseSkylineDatetaskStatusUpdate(
        principal: AuthPrincipal,
        input: DatetaskDto.UpdateDatetaskStatusDto
    ): Promise<DatetaskDto.DatetaskResponseDto> {
        if (
            input.status !== DatetaskConstants.DatetaskManageStatus.RUNNING &&
            input.status !== DatetaskConstants.DatetaskManageStatus.STOP
        ) {
            throw new BadRequestException('系统任务只能设置为启用或停用')
        }
        const task = await this.repository.manager.transaction(async manager => {
            const current = await this.datetaskUtilsService.findRequired(input.taskId, manager, true)
            this.assertTaskMutable(current)
            await manager.update(Schema.TbSkylineDatetaskSystem, { taskId: current.taskId }, {
                status: input.status,
                modifyBy: principal.uid
            } as never)
            return current
        })
        if (input.status === DatetaskConstants.DatetaskManageStatus.RUNNING) {
            this.datetaskSchedulerService.schedule(task.taskId)
        } else {
            this.datetaskSchedulerService.unschedule(task.taskId)
        }
        return this.httpBaseSkylineResolverDatetask({ taskId: task.taskId })
    }

    /** 修改系统任务 Cron 表达式。 */
    public async httpBaseSkylineUpdateDatetaskCron(
        principal: AuthPrincipal,
        input: DatetaskDto.UpdateDatetaskCronDto
    ): Promise<DatetaskDto.DatetaskResponseDto> {
        const cron = this.datetaskUtilsService.normalizeCron(input.cron)
        const task = await this.repository.manager.transaction(async manager => {
            const current = await this.datetaskUtilsService.findRequired(input.taskId, manager, true)
            this.assertTaskMutable(current)
            await manager.update(Schema.TbSkylineDatetaskSystem, { taskId: current.taskId }, { cron, modifyBy: principal.uid } as never)
            return { ...current, cron }
        })
        if (this.datetaskUtilsService.isSchedulable({ ...task, cron })) {
            this.datetaskSchedulerService.schedule(task.taskId)
        } else {
            this.datetaskSchedulerService.unschedule(task.taskId)
        }
        return this.httpBaseSkylineResolverDatetask({ taskId: task.taskId })
    }

    /** 手动触发一次系统任务，执行日志记录为手动执行并以当前账号作为触发人。 */
    public async httpBaseSkylineTriggerDatetask(
        principal: AuthPrincipal,
        input: DatetaskDto.TriggerDatetaskDto
    ): Promise<DatetaskDto.TriggerDatetaskResponseDto> {
        const task = await this.datetaskUtilsService.findRequired(input.taskId)
        const result = await this.datetaskExecutorService.execute(task.taskId, {
            triggerType: DatetaskConstants.DatetaskLogTrigger.MANUAL,
            uid: principal.uid
        })
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
        if (task.status === DatetaskConstants.DatetaskStatus.FINISH) {
            throw new BadRequestException('已完成任务不可修改')
        }
    }
}
