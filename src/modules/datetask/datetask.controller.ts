import { Body, Get, Headers, Post, Query } from '@nestjs/common'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { DatetaskService } from '@/modules/datetask/datetask.service'
import * as DatetaskDto from '@/modules/datetask/dto/datetask.dto'

/** 系统任务管理 HTTP 接口。 */
@ApifoxController('Skyline 系统任务管理', 'deploy/datetask', { bearerAuth: true })
export class DatetaskController {
    constructor(private readonly datetaskService: DatetaskService) {}

    @ApiServiceDecorator(Post('column'), {
        operation: { summary: '系统任务分页列表' },
        request: { source: 'body', type: DatetaskDto.ListDatetaskDto },
        response: { type: DatetaskDto.DatetaskPageResponseDto, description: '系统任务分页数据' },
        bearerAuth: true
    })
    public async httpBaseSkylineColumnDatetask(@Body() input: DatetaskDto.ListDatetaskDto): Promise<DatetaskDto.DatetaskPageResponseDto> {
        return this.datetaskService.httpBaseSkylineColumnDatetask(input)
    }

    @ApiServiceDecorator(Get('resolver'), {
        operation: { summary: '系统任务详情' },
        request: { source: 'query', type: DatetaskDto.ResolveDatetaskDto },
        response: { type: DatetaskDto.DatetaskResponseDto, description: '系统任务详情' },
        bearerAuth: true
    })
    public async httpBaseSkylineResolverDatetask(@Query() query: DatetaskDto.ResolveDatetaskDto): Promise<DatetaskDto.DatetaskResponseDto> {
        return this.datetaskService.httpBaseSkylineResolverDatetask(query)
    }

    @ApiServiceDecorator(Post('status/update'), {
        operation: { summary: '启用或停用系统任务' },
        request: { source: 'body', type: DatetaskDto.UpdateDatetaskStatusDto },
        response: { type: DatetaskDto.DatetaskResponseDto, description: '更新后的系统任务' },
        bearerAuth: true
    })
    public async httpBaseSkylineUpdateDatetaskStatus(
        @Body() input: DatetaskDto.UpdateDatetaskStatusDto
    ): Promise<DatetaskDto.DatetaskResponseDto> {
        return this.datetaskService.httpBaseSkylineUpdateDatetaskStatus(input)
    }

    @ApiServiceDecorator(Post('cron/update'), {
        operation: { summary: '修改系统任务 Cron 表达式' },
        request: { source: 'body', type: DatetaskDto.UpdateDatetaskCronDto },
        response: { type: DatetaskDto.DatetaskResponseDto, description: '更新后的系统任务' },
        bearerAuth: true
    })
    public async httpBaseSkylineUpdateDatetaskCron(
        @Body() input: DatetaskDto.UpdateDatetaskCronDto
    ): Promise<DatetaskDto.DatetaskResponseDto> {
        return this.datetaskService.httpBaseSkylineUpdateDatetaskCron(input)
    }

    @ApiServiceDecorator(Post('trigger'), {
        operation: { summary: '手动触发系统任务' },
        request: { source: 'body', type: DatetaskDto.TriggerDatetaskDto },
        response: { type: DatetaskDto.TriggerDatetaskResponseDto, description: '任务执行结果' },
        bearerAuth: true
    })
    public async httpBaseSkylineTriggerDatetask(
        @Body() input: DatetaskDto.TriggerDatetaskDto,
        @Headers('authorization') authorization?: string
    ): Promise<DatetaskDto.TriggerDatetaskResponseDto> {
        return this.datetaskService.httpBaseSkylineTriggerDatetask(input, authorization)
    }

    @ApiServiceDecorator(Post('log/column'), {
        operation: { summary: '系统任务执行日志' },
        request: { source: 'body', type: DatetaskDto.ListDatetaskLogDto },
        response: { type: DatetaskDto.DatetaskLogPageResponseDto, description: '任务执行日志分页数据' },
        bearerAuth: true
    })
    public async httpBaseSkylineColumnDatetaskLog(
        @Body() input: DatetaskDto.ListDatetaskLogDto
    ): Promise<DatetaskDto.DatetaskLogPageResponseDto> {
        return this.datetaskService.httpBaseSkylineColumnDatetaskLog(input)
    }
}
