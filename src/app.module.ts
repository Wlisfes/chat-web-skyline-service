import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { HealthModule } from '@/modules/health/health.module'
import { SkylineModule } from '@/modules/skyline/skyline.module'
import { SsrModule } from '@/modules/ssr/ssr.module'

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        NacosModule.forRoot({ serviceName: 'chat-web-skyline-service', registerPort: 4020 }),
        SsrModule,
        HealthModule,
        SkylineModule
    ]
})
export class AppModule {}
