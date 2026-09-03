import { Injectable, Logger } from '@nestjs/common'
import { SkylineLivenessResponseDto } from '@/dto/skyline-response.dto'

@Injectable()
export class AppService {
    constructor(private readonly logger: Logger) {}

    /**Skyline 服务欢迎信息。*/
    public async httpBaseSkylineWelcome(): Promise<string> {
        // Logger 通过依赖注入获取；不要再传第二个上下文参数，避免上下文与消息混排。
        this.logger.log('正在获取欢迎信息')
        return 'Hello World!'
    }

    /**Skyline 服务进程存活状态。*/
    public async httpBaseSkylineLiveness(): Promise<SkylineLivenessResponseDto> {
        return { status: 'UP' }
    }
}
