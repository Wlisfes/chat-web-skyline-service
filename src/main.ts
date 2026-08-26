import 'reflect-metadata'
import { join } from 'node:path'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { createRequestLoggingMiddleware, createStructuredLogger } from '@wlisfes/chat-web-base-schema/logging'
import { requestContextMiddleware } from '@wlisfes/chat-web-base-schema/request-context'
import { getCwd, initialSSRDevProxy } from 'ssr-common-utils'
import { AppModule } from './app.module'
import { SsrRendererService } from './modules/ssr/ssr-renderer.service'

const SERVICE_NAME = process.env.NACOS_SERVICE_NAME ?? 'chat-web-skyline-service'
const logger = createStructuredLogger({ serviceName: SERVICE_NAME })

export async function bootstrap(): Promise<NestExpressApplication> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger })
    app.enableShutdownHooks()
    app.use(requestContextMiddleware)
    app.use(createRequestLoggingMiddleware({ serviceName: SERVICE_NAME }))

    await initialSSRDevProxy(app, { express: true })
    app.useStaticAssets(join(getCwd(), 'build'))
    app.useStaticAssets(join(getCwd(), 'build/client'))
    app.useStaticAssets(join(getCwd(), 'public'))
    await app.get(SsrRendererService).markReady()
    if (process.env.NODE_ENV === 'development') {
        await app.listen(Number(process.env.PORT), '0.0.0.0')
        logger.log(`Chat Web Skyline 服务启动 [${process.env.NODE_ENV}]：http://127.0.0.1:${process.env.PORT}`)
    } else {
        await app.listen(Number(app.get(ConfigService).get<number>('server.port', 4020)), '0.0.0.0')
        logger.log(
            `Chat Web Skyline 服务启动 [${process.env.NODE_ENV}]：http://127.0.0.1:${app.get(ConfigService).get<number>('server.port', 4020)}`
        )
    }
    return app
}

if (require.main === module) {
    void bootstrap().catch(error => {
        logger.error(error, 'Bootstrap')
        process.exitCode = 1
    })
}
