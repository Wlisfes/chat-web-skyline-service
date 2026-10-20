import { Logger, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { AuthorizationGuard, AuthorizationModule, GatewayPrincipalGuard, GatewayPrincipalModule } from '@wlisfes/chat-web-base-schema/auth'
import { HttpResponseModule } from '@wlisfes/chat-web-base-schema/interceptor'
import { forRootNacosRuntimeOptions, NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
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
import { FeignModule } from '@/feign/feign.module'

@Module({
    imports: [
        HttpResponseModule,
        ConfigModule.forRoot({ isGlobal: true }),
        NacosModule.forRoot(forRootNacosRuntimeOptions(process.env)),
        GatewayPrincipalModule,
        AuthorizationModule,
        DatabaseModule,
        DatetaskModule,
        ChunkModule,
        CountryModule,
        OrganizationModule,
        SheetModule,
        RoleModule,
        UserModule,
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
