import { Logger, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { GatewayPrincipalGuard, GatewayPrincipalModule } from '@wlisfes/chat-web-base-schema/auth'
import { HttpResponseModule } from '@wlisfes/chat-web-base-schema/interceptor'
import { forRootNacosRuntimeOptions, NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DatabaseModule } from '@/database/database.module'
import { DatetaskModule } from '@/modules/datetask/datetask.module'
import { ChunkModule } from '@/modules/chunk/chunk.module'

@Module({
    imports: [
        HttpResponseModule,
        ConfigModule.forRoot({ isGlobal: true }),
        NacosModule.forRoot(forRootNacosRuntimeOptions(process.env)),
        // 用户认证在网关完成一次；Skyline 只校验网关签发的身份上下文签名。
        GatewayPrincipalModule,
        DatabaseModule,
        DatetaskModule,
        ChunkModule
    ],
    controllers: [AppController],
    providers: [Logger, AppService, { provide: APP_GUARD, useExisting: GatewayPrincipalGuard }]
})
export class AppModule {}
