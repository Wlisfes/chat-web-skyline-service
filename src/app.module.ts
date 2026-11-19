import { Logger, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { AuthorizationGuard, AuthorizationModule, GatewayPrincipalGuard, GatewayPrincipalModule } from '@wlisfes/chat-web-base-schema/auth'
import { HttpResponseModule } from '@wlisfes/chat-web-base-schema/interceptor'
import { forRootNacosRuntimeOptions, NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { RabbitmqModule, setupSkylineLoggerTopology } from '@wlisfes/chat-web-base-schema/rabbitmq'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DatabaseModule } from '@/database/database.module'
import { DatetaskModule } from '@/modules/datetask/datetask.module'
import { ChunkModule } from '@/modules/chunk/chunk.module'
import { CountryModule } from '@/modules/country/country.module'
import { OrganizationModule } from '@/modules/organization/organization.module'
import { RoleModule } from '@/modules/role/role.module'
import { SheetModule } from '@/modules/sheet/sheet.module'
import { UserModule } from '@/modules/user/user.module'
import { GarageModule } from '@/modules/garage/garage.module'
import { FeignModule } from '@/feign/feign.module'
import { SKYLINE_RABBITMQ_VHOST } from '@/modules/logger/logger.constants'
import { SkylineLoggerModule } from '@/modules/logger/logger.module'

/** Skyline 同时承载系统管理接口和操作日志发布；日志只入队，不在这里写库。 */
@Module({
    imports: [
        HttpResponseModule,
        ConfigModule.forRoot({ isGlobal: true }),
        NacosModule.forRoot(forRootNacosRuntimeOptions(process.env)),
        RabbitmqModule.forRoot({ vhost: SKYLINE_RABBITMQ_VHOST, setup: setupSkylineLoggerTopology }),
        GatewayPrincipalModule,
        AuthorizationModule,
        DatabaseModule,
        DatetaskModule,
        ChunkModule,
        CountryModule,
        OrganizationModule,
        SheetModule,
        SkylineLoggerModule,
        RoleModule,
        UserModule,
        GarageModule,
        FeignModule
    ],
    controllers: [AppController],
    providers: [
        Logger,
        AppService,
        { provide: APP_GUARD, useExisting: GatewayPrincipalGuard },
        { provide: APP_GUARD, useExisting: AuthorizationGuard }
    ]
})
export class AppModule {}
