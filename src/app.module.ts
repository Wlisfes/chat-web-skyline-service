import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { isNacosConfigEnabled } from './config/nacos-config'
import { HealthModule } from './modules/health/health.module'
import { SkylineModule } from './modules/skyline/skyline.module'
import { SsrModule } from './modules/ssr/ssr.module'
import { resolve } from 'path'

const configModule = ConfigModule.forRoot({
    isGlobal: true,
    cache: true,
    envFilePath: resolve(__dirname, `../env/.env.${process.env.NODE_ENV}`)
})
const nacosImports = isNacosConfigEnabled(process.env.NACOS_CONFIG_ENABLED)
    ? [NacosModule.forRoot({ serviceName: 'chat-web-skyline-service', registerPort: 4020 })]
    : []

@Module({
    imports: [configModule, ...nacosImports, SsrModule, HealthModule, SkylineModule]
})
export class AppModule {}
