import { Body, Get, Post, Query } from '@nestjs/common'
import { CurrentPrincipal, RequirePermissions, type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { DatetaskService } from '@/modules/datetask/datetask.service'
import * as DatetaskDto from '@/modules/datetask/dto/datetask.dto'

/** 系统任务管理 HTTP 接口。 */
@ApifoxController('Skyline 系统任务管理', 'deploy/datetask', { bearerAuth: true })
export class DatetaskController {
    constructor(private readonly datetaskService: DatetaskService) {}

    @RequirePermissions('chat:deploy:datetask:system')
    @ApiServiceDecorator(Get('enums'), {
        operation: { summary: '系统任务静态枚举' },
        response: { type: DatetaskDto.DatetaskEnumsResponseDto, description: '系统任务静态枚举' }
    })
    public async httpBaseSkylineDatetaskEnums(): Promise<DatetaskDto.DatetaskEnumsResponseDto> {
        return this.datetaskService.httpBaseSkylineDatetaskEnums()
    }

    @RequirePermissions('chat:deploy:datetask:system')
    @ApiServiceDecorator(Post('column'), {
        operation: { summary: '系统任务分页列表' },
        request: { source: 'body', type: DatetaskDto.ListDatetaskDto },
        response: { type: DatetaskDto.DatetaskPageResponseDto, description: '系统任务分页数据' }
    })
    public async httpBaseSkylineColumnDatetask(@Body() input: DatetaskDto.ListDatetaskDto) {
        return this.datetaskService.httpBaseSkylineColumnDatetask(input)
    }

    @RequirePermissions('chat:deploy:datetask:system')
    @ApiServiceDecorator(Get('resolve'), {
        operation: { summary: '系统任务详情' },
        request: { source: 'query', type: DatetaskDto.ResolveDatetaskDto },
        response: { type: DatetaskDto.DatetaskResponseDto, description: '系统任务详情' }
    })
    public async httpBaseSkylineResolverDatetask(@Query() query: DatetaskDto.ResolveDatetaskDto): Promise<DatetaskDto.DatetaskResponseDto> {
        return this.datetaskService.httpBaseSkylineResolverDatetask(query)
    }

    @RequirePermissions('chat:deploy:datetask:system:status:update')
    @ApiServiceDecorator(Post('status/update'), {
        operation: { summary: '启用或停用系统任务' },
        request: { source: 'body', type: DatetaskDto.UpdateDatetaskStatusDto },
        response: { type: DatetaskDto.DatetaskResponseDto, description: '更新后的系统任务' }
    })
    public async httpBaseSkylineDatetaskStatusUpdate(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() input: DatetaskDto.UpdateDatetaskStatusDto
    ): Promise<DatetaskDto.DatetaskResponseDto> {
        return this.datetaskService.httpBaseSkylineDatetaskStatusUpdate(principal, input)
    }

    @RequirePermissions('chat:deploy:datetask:system:update')
    @ApiServiceDecorator(Post('cron/update'), {
        operation: { summary: '修改系统任务 Cron 表达式' },
        request: { source: 'body', type: DatetaskDto.UpdateDatetaskCronDto },
        response: { type: DatetaskDto.DatetaskResponseDto, description: '更新后的系统任务' }
    })
    public async httpBaseSkylineUpdateDatetaskCron(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() input: DatetaskDto.UpdateDatetaskCronDto
    ): Promise<DatetaskDto.DatetaskResponseDto> {
        return this.datetaskService.httpBaseSkylineUpdateDatetaskCron(principal, input)
    }

    @RequirePermissions('chat:deploy:datetask:system:trigger')
    @ApiServiceDecorator(Post('trigger'), {
        operation: { summary: '手动触发系统任务' },
        request: { source: 'body', type: DatetaskDto.TriggerDatetaskDto },
        response: { type: DatetaskDto.TriggerDatetaskResponseDto, description: '任务执行结果' }
    })
    public async httpBaseSkylineTriggerDatetask(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() input: DatetaskDto.TriggerDatetaskDto
    ): Promise<DatetaskDto.TriggerDatetaskResponseDto> {
        return this.datetaskService.httpBaseSkylineTriggerDatetask(principal, input)
    }

    @RequirePermissions('chat:deploy:datetask:system:logs')
    @ApiServiceDecorator(Post('log/column'), {
        operation: { summary: '系统任务执行日志' },
        request: { source: 'body', type: DatetaskDto.ListDatetaskLogDto },
        response: { type: DatetaskDto.DatetaskLogPageResponseDto, description: '任务执行日志分页数据' }
    })
    public async httpBaseSkylineColumnDatetaskLog(@Body() input: DatetaskDto.ListDatetaskLogDto) {
        return this.datetaskService.httpBaseSkylineColumnDatetaskLog(input)
    }
}
