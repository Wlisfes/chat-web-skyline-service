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
                serviceName: 'chat-web-skyline-service',
                registerPort: 4020,
                NACOS_SERVER: process.env.NACOS_SERVER,
                NACOS_NAMESPACE: process.env.NACOS_NAMESPACE,
                NACOS_USERNAME: process.env.NACOS_USERNAME,
                NACOS_PASSWORD: process.env.NACOS_PASSWORD,
                NACOS_REQUEST_TIMEOUT: process.env.NACOS_REQUEST_TIMEOUT,
                NACOS_CONFIG_DATA_ID: process.env.NACOS_CONFIG_DATA_ID,
                NACOS_CONFIG_GROUP: process.env.NACOS_CONFIG_GROUP,
                NACOS_REGISTER_ENABLED: process.env.NACOS_REGISTER_ENABLED,
                NACOS_REGISTER_REQUIRED: process.env.NACOS_REGISTER_REQUIRED,
                NACOS_GROUP: process.env.NACOS_GROUP,
                NACOS_REGISTER_IP: process.env.NACOS_REGISTER_IP,
                NACOS_REGISTER_PORT: process.env.NACOS_REGISTER_PORT,
                PORT: process.env.PORT
            })
        )
    ],
    controllers: [AppController],
    providers: [Logger, AppService]
})
export class AppModule {}
