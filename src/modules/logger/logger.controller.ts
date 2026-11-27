import { Body, Post } from '@nestjs/common'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { CurrentPrincipal, RequirePermissions, type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { SkylineLoggerService } from '@/modules/logger/logger.service'
import * as LoggerDto from '@/modules/logger/dto/logger.dto'

@ApifoxController('Skyline 日志', 'deploy/logger', { bearerAuth: true })
export class SkylineLoggerController {
    constructor(private readonly loggerService: SkylineLoggerService) {}

    @RequirePermissions('chat:deploy:system:logger')
    @ApiServiceDecorator(Post('column'), {
        operation: { summary: '按页面功能分页查询日志' },
        request: { source: 'body', type: LoggerDto.LoggerColumnQueryDto },
        response: { type: LoggerDto.LoggerPageResponseDto, description: '日志分页数据' }
    })
    public async httpBaseSkylineColumnLogger(
        @CurrentPrincipal() _principal: AuthPrincipal,
        @Body() body: LoggerDto.LoggerColumnQueryDto
    ) {
        return this.loggerService.httpBaseSkylineColumnLogger(body)
    }
}
