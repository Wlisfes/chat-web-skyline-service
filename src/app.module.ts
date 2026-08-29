import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { forRootNacosRuntimeOptions, NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true }), NacosModule.forRoot(forRootNacosRuntimeOptions(process.env))],
    controllers: [AppController],
    providers: [Logger, AppService]
})
export class AppModule {}
