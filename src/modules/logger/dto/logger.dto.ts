import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { PageListResponseDto } from '@wlisfes/chat-web-base-schema/decorator'
import { PageDto } from '@wlisfes/chat-web-base-schema/utils'
import { TbSkylineLoggerResult } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'

/** 日志列表项。 */
export class LoggerItemDto {
    @ApiProperty({ description: '表主键', example: 1 })
    keyId: number

    @ApiProperty({ description: '请求日志号', example: '34ec4ca9-2abf-49b8-85f6-77d7fd23ea1d' })
    logId: string

    @ApiProperty({ description: '产生操作的服务名', example: 'chat-web-skyline-service' })
    serviceName: string

    @ApiProperty({ description: '操作权限码', example: 'chat:deploy:system:sheet:create' })
    permissionCode: string

    @ApiPropertyOptional({ description: '写入时解析到的菜单节点主键', example: 1 })
    sheetKeyId: number

    @ApiPropertyOptional({ description: '写入时的菜单名称快照', example: '新增菜单' })
    sheetName: string

    @ApiPropertyOptional({ description: '业务对象类型', example: 'sheet' })
    resourceType: string

    @ApiPropertyOptional({ description: '业务对象主键或业务编号', example: '1024' })
    resourceId: string

    @ApiPropertyOptional({ description: '操作人账号UID' })
    operatorUid: string

    @ApiPropertyOptional({ description: '操作人工号' })
    operatorNumber: string

    @ApiPropertyOptional({ description: '操作人姓名', example: '张三' })
    operatorName: string

    @ApiProperty({ description: 'HTTP 方法', example: 'POST' })
    method: string

    @ApiProperty({ description: '请求路径', example: '/deploy/sheet/create' })
    url: string

    @ApiProperty({ description: '操作结果', enum: TbSkylineLoggerResult, example: TbSkylineLoggerResult.SUCCESS })
    result: TbSkylineLoggerResult

    @ApiPropertyOptional({ description: '失败原因或结果说明' })
    message: string

    @ApiProperty({ description: '操作时间', example: '2026-11-19 11:30:00' })
    createTime: string
}

/** 按菜单节点分页查询日志。选中目录或菜单时包含其全部下级按钮。 */
export class LoggerColumnQueryDto extends PageDto {
    @ApiPropertyOptional({ description: '菜单节点主键；传入目录或菜单时包含其全部下级按钮', example: 1 })
    @Type(() => Number)
    @IsOptional()
    @IsInt({ message: '菜单节点主键必须是整数' })
    @Min(1, { message: '菜单节点主键必须大于0' })
    sheetKeyId: number

    @ApiPropertyOptional({ description: '操作权限码；与菜单节点同时传入时取交集', example: 'chat:deploy:system:sheet:create' })
    @IsOptional()
    @IsString({ message: '操作权限码必须是字符串' })
    @MaxLength(128, { message: '操作权限码长度不能超过128位' })
    permissionCode: string

    @ApiPropertyOptional({ description: '操作人姓名或工号，模糊匹配', example: '张三' })
    @IsOptional()
    @IsString({ message: '操作人必须是字符串' })
    @MaxLength(64, { message: '操作人长度不能超过64位' })
    operatorName: string

    @ApiPropertyOptional({ description: '请求日志号', example: '34ec4ca9-2abf-49b8-85f6-77d7fd23ea1d' })
    @IsOptional()
    @IsString({ message: '日志ID必须是字符串' })
    @MaxLength(64, { message: '日志ID长度不能超过64位' })
    logId: string

    @ApiPropertyOptional({ description: '操作结果', enum: TbSkylineLoggerResult })
    @IsOptional()
    @IsEnum(TbSkylineLoggerResult, { message: '操作结果格式错误' })
    result: TbSkylineLoggerResult

    @ApiPropertyOptional({ description: '业务对象类型', example: 'sheet' })
    @IsOptional()
    @IsString({ message: '业务对象类型必须是字符串' })
    @MaxLength(64, { message: '业务对象类型长度不能超过64位' })
    resourceType: string

    @ApiPropertyOptional({ description: '业务对象主键或业务编号', example: '1024' })
    @IsOptional()
    @IsString({ message: '业务对象标识必须是字符串' })
    @MaxLength(64, { message: '业务对象标识长度不能超过64位' })
    resourceId: string

    @ApiPropertyOptional({ description: '开始时间，格式 YYYY-MM-DD HH:mm:ss', example: '2026-11-19 00:00:00' })
    @IsOptional()
    @IsString({ message: '开始时间必须是字符串' })
    @MaxLength(23, { message: '开始时间长度不能超过23位' })
    startTime: string

    @ApiPropertyOptional({ description: '结束时间，格式 YYYY-MM-DD HH:mm:ss', example: '2026-11-19 23:59:59' })
    @IsOptional()
    @IsString({ message: '结束时间必须是字符串' })
    @MaxLength(23, { message: '结束时间长度不能超过23位' })
    endTime: string
}

/** 日志分页响应。 */
export class LoggerPageResponseDto extends PageListResponseDto(LoggerItemDto, '按页面功能筛选的日志') {}
