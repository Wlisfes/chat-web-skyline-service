import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { HealthModule } from './modules/health/health.module'
import { SkylineModule } from './modules/skyline/skyline.module'
import { SsrModule } from './modules/ssr/ssr.module'
import { resolve } from 'path'

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,
            envFilePath: resolve(__dirname, `../env/.env.${process.env.NODE_ENV}`)
        }),
        NacosModule.forRoot({ serviceName: 'chat-web-skyline-service', registerPort: 4020 }),
        SsrModule,
        HealthModule,
        SkylineModule
    ]
})
export class AppModule {}
