import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { PageResult } from '@wlisfes/chat-web-base-schema/utils'
import * as TaskSchema from '@wlisfes/chat-web-base-schema/chat-web-task-mysql'
import * as feign from '@wlisfes/chat-web-base-schema/feign'
import { UserService } from '@/modules/user/user.service'
import * as DatetaskDto from '@/modules/datetask/dto/datetask.dto'

/**
 * 系统任务管理：定时任务已迁出到 chat-web-task-service，本服务只负责登录、按钮权限校验和操作人还原，
 * 读写全部通过 /feign/task 服务间接口委托 Task 服务；Task 服务不可用时只影响页面操作，不影响任务调度。
 */
@Injectable()
export class DatetaskService {
    constructor(
        private readonly taskFeignClient: feign.FeignClientTaskManager,
        private readonly userService: UserService,
        private readonly configService: ConfigService
    ) {}

    /** 系统任务静态枚举；直接读取共享枚举定义，Task 服务不可用时也能正常显示。 */
    public async httpBaseSkylineDatetaskEnums(): Promise<DatetaskDto.DatetaskEnumsResponseDto> {
        return {
            moduleOptions: TaskSchema.TbTaskCronModuleDefinition.options,
            statusOptions: TaskSchema.TbTaskCronStatusDefinition.options,
            logStatusOptions: TaskSchema.TbTaskExecutionStatusDefinition.options,
            triggerTypeOptions: TaskSchema.TbTaskExecutionTriggerDefinition.options
        }
    }

    /** 系统任务分页列表。 */
    public async httpBaseSkylineColumnDatetask(input: DatetaskDto.ListDatetaskDto): Promise<PageResult<DatetaskDto.DatetaskResponseDto>> {
        const result = await this.taskFeignClient.httpBaseTaskColumnCron(this.authorization(), input)
        return { ...result, list: await this.appendUserOptions(result.list, ['createBy', 'modifyBy']) }
    }

    /** 系统任务详情。 */
    public async httpBaseSkylineResolverDatetask(query: DatetaskDto.ResolveDatetaskDto): Promise<DatetaskDto.DatetaskResponseDto> {
        const task = await this.taskFeignClient.httpBaseTaskCronResolver(this.authorization(), { taskId: query.taskId })
        return (await this.appendUserOptions([task], ['createBy', 'modifyBy']))[0]
    }

    /** 启用或停用系统任务。 */
    public async httpBaseSkylineDatetaskStatusUpdate(
        principal: AuthPrincipal,
        input: DatetaskDto.UpdateDatetaskStatusDto
    ): Promise<DatetaskDto.DatetaskResponseDto> {
        const task = await this.taskFeignClient.httpBaseTaskCronStatusUpdate(this.authorization(), {
            taskId: input.taskId,
            status: input.status,
            operatorUid: principal.uid
        })
        return (await this.appendUserOptions([task], ['createBy', 'modifyBy']))[0]
    }

    /** 修改系统任务 Cron 表达式。 */
    public async httpBaseSkylineUpdateDatetaskCron(
        principal: AuthPrincipal,
        input: DatetaskDto.UpdateDatetaskCronDto
    ): Promise<DatetaskDto.DatetaskResponseDto> {
        const task = await this.taskFeignClient.httpBaseTaskUpdateCron(this.authorization(), {
            taskId: input.taskId,
            cron: input.cron,
            operatorUid: principal.uid
        })
        return (await this.appendUserOptions([task], ['createBy', 'modifyBy']))[0]
    }

    /** 手动触发系统任务；Task 服务最多等待数秒，未结束时返回执行记录供页面轮询。 */
    public async httpBaseSkylineTriggerDatetask(
        principal: AuthPrincipal,
        input: DatetaskDto.TriggerDatetaskDto
    ): Promise<DatetaskDto.TriggerDatetaskResponseDto> {
        const result = await this.taskFeignClient.httpBaseTaskTriggerCron(this.authorization(), {
            taskId: input.taskId,
            operatorUid: principal.uid
        })
        const [execution] = await this.appendUserOptions([result.execution], ['createBy'])
        return { executionId: result.executionId, finished: result.finished, execution }
    }

    /** 查询系统任务执行日志。 */
    public async httpBaseSkylineColumnDatetaskLog(
        input: DatetaskDto.ListDatetaskLogDto
    ): Promise<PageResult<DatetaskDto.DatetaskLogResponseDto>> {
        const result = await this.taskFeignClient.httpBaseTaskColumnExecution(this.authorization(), input)
        return { ...result, list: await this.appendUserOptions(result.list, ['createBy']) }
    }

    /** 查询单条执行日志，用于手动触发后轮询结果。 */
    public async httpBaseSkylineResolverDatetaskLog(input: DatetaskDto.ResolveDatetaskLogDto): Promise<DatetaskDto.DatetaskLogResponseDto> {
        const execution = await this.taskFeignClient.httpBaseTaskExecutionResolver(this.authorization(), { executionId: input.executionId })
        return (await this.appendUserOptions([execution], ['createBy']))[0]
    }

    /** 调用 Task 服务统一使用服务间凭据，不转发终端用户令牌。 */
    private authorization(): string {
        return feign.resolveFeignServiceAuthorization(this.configService)
    }

    /**
     * 把操作人 UID 还原为 `<字段名>Options`。用户数据就在本服务，直接本地查询，不再经 Feign 调用自己；
     * 系统账号 `0` 固定显示为「系统」，账号不存在时保留 `{ uid }`。
     */
    private async appendUserOptions<TItem extends object>(list: TItem[], keys: Array<keyof TItem & string>): Promise<TItem[]> {
        const uids = [
            ...new Set(
                list.flatMap(item => keys.map(key => item[key])).filter((uid): uid is never => typeof uid === 'string' && uid.length > 0)
            )
        ].filter(uid => uid !== feign.SKYLINE_SYSTEM_UID) as string[]
        const options = new Map<string, feign.SkylineUserOption>([
            [feign.SKYLINE_SYSTEM_UID, { uid: feign.SKYLINE_SYSTEM_UID, name: feign.SKYLINE_SYSTEM_NAME }]
        ])
        if (uids.length > 0) {
            for (let index = 0; index < uids.length; index += 100) {
                const users = await this.userService.httpBaseSkylineColumnUserResolver({ uids: uids.slice(index, index + 100) })
                for (const user of users) options.set(user.uid, user)
            }
        }
        for (const item of list) {
            const record = item as Record<string, unknown>
            for (const key of keys) {
                const uid = record[key]
                record[`${key}Options`] = typeof uid === 'string' && uid ? (options.get(uid) ?? { uid }) : undefined
            }
        }
        return list
    }
}
