import { Get, Header } from '@nestjs/common'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { SkylineLivenessResponseDto } from '@/dto/skyline-response.dto'
import { AppService } from '@/app.service'

@ApifoxController('Skyline 服务')
export class AppController {
    constructor(private readonly appService: AppService) {}

    @ApiServiceDecorator(Get(), {
        operation: { summary: '获取 Skyline 服务欢迎信息' },
        response: {
            type: String,
            example: 'Hello World!',
            contentType: 'text/plain',
            envelope: false,
            description: 'Skyline 服务欢迎信息'
        },
        produces: ['text/plain']
    })
    @Header('Content-Type', 'text/plain; charset=utf-8')
    public async httpBaseSkylineWelcome(): Promise<string> {
        return this.appService.httpBaseSkylineWelcome()
    }

    @ApiServiceDecorator(Get('health/live'), {
        operation: { summary: 'Skyline 服务存活检查' },
        response: { type: SkylineLivenessResponseDto, envelope: false, description: '进程正常时返回 UP' }
    })
    public async httpBaseSkylineLiveness(): Promise<SkylineLivenessResponseDto> {
        return this.appService.httpBaseSkylineLiveness()
    }
}
