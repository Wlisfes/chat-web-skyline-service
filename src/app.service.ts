import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class AppService {
    constructor(private readonly logger: Logger) {}

    getHello(): string {
        this.logger.log('正在获取欢迎信息', AppService.name)
        return 'Hello World!'
    }
}
