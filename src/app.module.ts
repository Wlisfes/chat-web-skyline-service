import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { createNacosRuntimeOptions, NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        NacosModule.forRoot(
            createNacosRuntimeOptions({
                serviceName: process.env.NACOS_SERVICE_NAME!,
                registerPort: process.env.PORT,
                NACOS_SERVER: process.env.NACOS_SERVER,
                NACOS_NAMESPACE: process.env.NACOS_NAMESPACE
            })
        )
    ],
    controllers: [AppController],
    providers: [Logger, AppService]
})
export class AppModule {}
