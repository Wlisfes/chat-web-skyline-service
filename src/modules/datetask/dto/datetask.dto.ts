import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator'
import { EnumsResponseDto, PageResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { PageDto } from '@wlisfes/chat-web-base-schema/utils'
import * as TaskSchema from '@wlisfes/chat-web-base-schema/chat-web-task-mysql'
import * as feign from '@wlisfes/chat-web-base-schema/feign'

/** 系统任务分页查询参数；任务数据由 Task 服务提供，只保留周期任务。 */
export class ListDatetaskDto extends IntersectionType(
    PageDto,
    PartialType(PickType(TaskSchema.TbTaskCronDto, ['taskName', 'module', 'status'] as const))
) {}

/** 系统任务主键参数。 */
export class DatetaskKeyDto {
    @ApiProperty({ description: '任务ID（19位数字字符串）', example: '2149446185344106496' })
    @IsString({ message: '任务ID必须是字符串' })
    @IsNotEmpty({ message: '任务ID不能为空' })
    @Matches(/^\d{1,19}$/, { message: '任务ID必须是1至19位数字字符串' })
    taskId: string
}

/** 系统任务详情查询参数。 */
export class ResolveDatetaskDto extends DatetaskKeyDto {}

/** 启用或停用系统任务参数。 */
export class UpdateDatetaskStatusDto extends DatetaskKeyDto {
    @ApiProperty({
        description: TaskSchema.TbTaskCronStatusDefinition.comment,
        enum: TaskSchema.TbTaskCronStatus,
        example: TaskSchema.TbTaskCronStatus.ENABLE
    })
    @IsEnum(TaskSchema.TbTaskCronStatus, { message: '任务状态格式错误' })
    status: TaskSchema.TbTaskCronStatus
}

/** 修改系统任务 Cron 参数。 */
export class UpdateDatetaskCronDto extends DatetaskKeyDto {
    @ApiProperty({ description: 'Cron 表达式；汇率任务默认每天 08:00、20:00 各执行一次', example: '0 0 8,20 * * *' })
    @IsString({ message: 'Cron表达式必须是字符串' })
    @IsNotEmpty({ message: 'Cron表达式不能为空' })
    @MaxLength(32, { message: 'Cron表达式长度不能超过32位' })
    cron: string
}

/** 手动触发系统任务参数。 */
export class TriggerDatetaskDto extends DatetaskKeyDto {}

/** 系统任务执行日志分页查询参数。 */
export class ListDatetaskLogDto extends IntersectionType(PageDto, DatetaskKeyDto) {
    @ApiPropertyOptional({
        description: TaskSchema.TbTaskExecutionStatusDefinition.comment,
        enum: TaskSchema.TbTaskExecutionStatus,
        example: TaskSchema.TbTaskExecutionStatus.SUCCESS
    })
    @IsOptional()
    @IsEnum(TaskSchema.TbTaskExecutionStatus, { message: '执行状态格式错误' })
    status?: TaskSchema.TbTaskExecutionStatus
}

/** 单条执行记录查询参数，用于手动触发后轮询结果。 */
export class ResolveDatetaskLogDto {
    @ApiProperty({ description: '执行记录ID（19位数字字符串）', example: '2150123456789012345' })
    @IsString({ message: '执行记录ID必须是字符串' })
    @IsNotEmpty({ message: '执行记录ID不能为空' })
    @Matches(/^\d{1,19}$/, { message: '执行记录ID必须是1至19位数字字符串' })
    executionId: string
}

/** 系统任务详情响应。 */
export class DatetaskResponseDto extends TaskSchema.TbTaskCronDto {
    @ApiPropertyOptional({ description: '创建人选项，通过 Skyline 账号按 createBy 还原', type: feign.SkylineUserOptionResponseDto })
    createByOptions?: feign.SkylineUserOptionResponseDto

    @ApiPropertyOptional({ description: '更新人选项，通过 Skyline 账号按 modifyBy 还原', type: feign.SkylineUserOptionResponseDto })
    modifyByOptions?: feign.SkylineUserOptionResponseDto
}

/** 系统任务分页响应。 */
export class DatetaskPageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '系统任务列表', type: [DatetaskResponseDto] })
    list: DatetaskResponseDto[]
}

/** 任务执行日志返回项。 */
export class DatetaskLogResponseDto extends TaskSchema.TbTaskExecutionDto {
    @ApiPropertyOptional({ description: '触发人选项，通过 Skyline 账号按 createBy 还原', type: feign.SkylineUserOptionResponseDto })
    createByOptions?: feign.SkylineUserOptionResponseDto
}

/** 系统任务日志分页响应。 */
export class DatetaskLogPageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '任务执行日志列表', type: [DatetaskLogResponseDto] })
    list: DatetaskLogResponseDto[]
}

/** 手动触发任务响应；finished 为 false 时按 executionId 轮询执行日志详情。 */
export class TriggerDatetaskResponseDto {
    @ApiProperty({ description: '执行记录ID', example: '2150123456789012345' })
    executionId: string

    @ApiProperty({ description: '是否已在等待时间内结束（成功或失败）', example: true })
    finished: boolean

    @ApiProperty({ description: '执行记录', type: DatetaskLogResponseDto })
    execution: DatetaskLogResponseDto
}

/** 系统任务静态枚举响应。 */
export class DatetaskEnumsResponseDto extends EnumsResponseDto({
    moduleOptions: { description: '任务所属模块选项', example: TaskSchema.TbTaskCronModuleDefinition.options },
    statusOptions: { description: '任务状态选项', example: TaskSchema.TbTaskCronStatusDefinition.options },
    logStatusOptions: { description: '执行状态选项', example: TaskSchema.TbTaskExecutionStatusDefinition.options },
    triggerTypeOptions: { description: '触发方式选项', example: TaskSchema.TbTaskExecutionTriggerDefinition.options }
}) {}
