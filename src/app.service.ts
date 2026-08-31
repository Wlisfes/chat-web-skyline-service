import { Injectable, Logger } from '@nestjs/common'
import { SkylineLivenessResponseDto } from '@/dto/skyline-response.dto'

@Injectable()
export class AppService {
    constructor(private readonly logger: Logger) {}

    /**Skyline 服务欢迎信息。*/
    public async httpBaseSkylineWelcome(): Promise<string> {
        this.logger.log('正在获取欢迎信息', AppService.name)
        return 'Hello World!'
    }

    /**Skyline 服务进程存活状态。*/
    public async httpBaseSkylineLiveness(): Promise<SkylineLivenessResponseDto> {
        return { status: 'UP' }
    }
}
