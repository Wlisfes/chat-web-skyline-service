import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator'
import { TbSkylineDatetaskSystemDto } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { PageDto } from '@wlisfes/chat-web-base-schema/utils'
import { PageResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { DatetaskLogStatus, DatetaskManageStatus, DatetaskStatus } from '@/modules/datetask/datetask.constants'

/** 系统任务分页查询参数。 */
export class ListDatetaskDto extends IntersectionType(
    PageDto,
    PartialType(PickType(TbSkylineDatetaskSystemDto, ['taskName', 'status'] as const))
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

/** 更新系统任务状态参数；管理端只能在启用和停用之间切换。 */
export class UpdateDatetaskStatusDto extends DatetaskKeyDto {
    @ApiProperty({ description: '任务状态', enum: DatetaskManageStatus, example: DatetaskManageStatus.RUNNING })
    @IsEnum(DatetaskManageStatus, { message: '任务状态格式错误' })
    status: DatetaskManageStatus
}

/** 更新系统任务 Cron 参数。 */
export class UpdateDatetaskCronDto extends DatetaskKeyDto {
    @ApiProperty({ description: 'Cron 表达式', example: '0 0 8 * * *' })
    @IsString({ message: 'Cron表达式必须是字符串' })
    @IsNotEmpty({ message: 'Cron表达式不能为空' })
    @MaxLength(32, { message: 'Cron表达式长度不能超过32位' })
    cron: string
}

/** 手动触发系统任务参数。 */
export class TriggerDatetaskDto extends DatetaskKeyDto {}

/** 系统任务执行日志分页查询参数。 */
export class ListDatetaskLogDto extends IntersectionType(PageDto, DatetaskKeyDto) {
    @ApiPropertyOptional({ description: '执行状态', enum: DatetaskLogStatus, example: DatetaskLogStatus.SUCCESS })
    @IsOptional()
    @IsEnum(DatetaskLogStatus, { message: '执行状态格式错误' })
    status?: DatetaskLogStatus
}

/** 汇率同步任务响应数据。 */
export class ExchangeSyncResultDto {
    @ApiProperty({ description: '实际汇率日期', format: 'date', example: '2026-09-02' })
    @IsDateString({}, { message: '汇率日期格式错误' })
    date: string

    @ApiProperty({ description: '写入条数', example: 30 })
    @Type(() => Number)
    @IsInt({ message: '写入条数必须是整数' })
    @Min(0, { message: '写入条数不能小于0' })
    count: number
}

/** 汇率同步结果明细。 */
export class DatetaskExchangeRateItemDto {
    @ApiProperty({ description: '币种编码', example: 'CNY' })
    currency: string

    @ApiProperty({ description: '基于 USD 的汇率', example: 7.2534 })
    rate: number

    @ApiProperty({ description: '汇率日期', format: 'date', example: '2026-09-02' })
    date: string
}

/** 任务执行结果，覆盖成功、跳过和失败场景。 */
export class DatetaskExecutionResultDto {
    @ApiPropertyOptional({ description: '实际汇率日期', format: 'date', example: '2026-09-02' })
    date?: string

    @ApiPropertyOptional({ description: '写入条数', example: 30 })
    count?: number

    @ApiPropertyOptional({ description: '汇率同步明细', type: [DatetaskExchangeRateItemDto] })
    list?: DatetaskExchangeRateItemDto[]

    @ApiPropertyOptional({ description: '是否跳过本次执行', example: true })
    skipped?: boolean

    @ApiPropertyOptional({ description: '跳过原因', example: '任务正在其他实例执行' })
    reason?: string

    @ApiPropertyOptional({ description: '失败或补充说明', example: 'Finance 服务暂不可用' })
    message?: string
}

/** 任务执行日志返回项。 */
export class DatetaskLogResponseDto {
    @ApiProperty({ description: '执行记录唯一标识，用于列表行标识', example: '2149446185344106496:1756771200000:1' })
    keyId: string

    @ApiProperty({ description: '任务ID', example: '2149446185344106496' })
    taskId: string

    @ApiProperty({ description: '执行状态', enum: DatetaskLogStatus, example: DatetaskLogStatus.SUCCESS })
    status: DatetaskLogStatus

    @ApiProperty({ description: '耗时（毫秒）', example: 1250 })
    duration: number

    @ApiProperty({ description: '开始时间', example: '2026-09-02 08:00:00.000' })
    startTime: string

    @ApiProperty({ description: '结束时间', example: '2026-09-02 08:00:01.250' })
    endTime?: string

    @ApiPropertyOptional({ description: '执行结果或错误信息', type: DatetaskExecutionResultDto })
    result?: DatetaskExecutionResultDto
}

/** 系统任务详情响应。 */
export class DatetaskResponseDto extends TbSkylineDatetaskSystemDto {}

/** 系统任务分页响应。 */
export class DatetaskPageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '系统任务列表', type: [DatetaskResponseDto] })
    list: DatetaskResponseDto[]
}

/** 系统任务日志分页响应。 */
export class DatetaskLogPageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '任务执行日志列表', type: [DatetaskLogResponseDto] })
    list: DatetaskLogResponseDto[]
}

/** 手动触发任务响应。 */
export class TriggerDatetaskResponseDto {
    @ApiProperty({ description: '是否触发成功', example: true })
    success: boolean

    @ApiPropertyOptional({ description: '执行结果', type: DatetaskExecutionResultDto })
    result?: DatetaskExecutionResultDto
}
