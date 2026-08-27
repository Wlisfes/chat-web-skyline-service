import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        NacosModule.forRoot({ serviceName: 'chat-web-skyline-service', registerPort: 3000 })
    ],
    controllers: [AppController],
    providers: [AppService]
})
export class AppModule {}
