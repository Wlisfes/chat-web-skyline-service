import { Logger, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { GatewayPrincipalGuard, GatewayPrincipalModule } from '@wlisfes/chat-web-base-schema/auth'
import { HttpResponseModule } from '@wlisfes/chat-web-base-schema/interceptor'
import { forRootNacosRuntimeOptions, NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DatabaseModule } from '@/modules/database/database.module'
import { DatetaskModule } from '@/modules/datetask/datetask.module'

/** Jest 的基础 e2e 只验证进程路由，不连接真实 MySQL；生产和本地运行始终启用业务模块。 */
const isTestRuntime = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID)

@Module({
    imports: [
        HttpResponseModule,
        ConfigModule.forRoot({ isGlobal: true }),
        NacosModule.forRoot(forRootNacosRuntimeOptions(process.env)),
        // 用户认证在网关完成一次；Skyline 只校验网关签发的身份上下文签名。
        ...(isTestRuntime ? [] : [GatewayPrincipalModule, DatabaseModule, DatetaskModule])
    ],
    controllers: [AppController],
    providers: [Logger, AppService, ...(isTestRuntime ? [] : [{ provide: APP_GUARD, useExisting: GatewayPrincipalGuard }])]
})
export class AppModule {}
