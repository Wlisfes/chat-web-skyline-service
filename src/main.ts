import 'reflect-metadata'
import { join } from 'node:path'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { createRequestLoggingMiddleware, createStructuredLogger } from '@wlisfes/chat-web-base-schema/logging'
import { requestContextMiddleware } from '@wlisfes/chat-web-base-schema/request-context'
import { getCwd, initialSSRDevProxy, loadConfig } from 'ssr-common-utils'
import { AppModule } from './app.module'
import { SsrRendererService } from './modules/ssr/ssr-renderer.service'

const SERVICE_NAME = 'chat-web-skyline-service'
const logger = createStructuredLogger({ serviceName: SERVICE_NAME })

function resolvePort(value: unknown): number {
    const port = Number(value)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('服务端口必须是 1-65535 之间的整数')
    }
    return port
}

export async function bootstrap(): Promise<NestExpressApplication> {
    if (process.env.PORT && !process.env.NACOS_REGISTER_PORT) {
        process.env.NACOS_REGISTER_PORT = process.env.PORT
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger })
    app.enableShutdownHooks()
    app.use(requestContextMiddleware)
    app.use(createRequestLoggingMiddleware({ serviceName: SERVICE_NAME }))

    await initialSSRDevProxy(app, { express: true })
    app.useStaticAssets(join(getCwd(), 'build'))
    app.useStaticAssets(join(getCwd(), 'build/client'))
    app.useStaticAssets(join(getCwd(), 'public'))

    const port = Number(process.env.PORT ?? app.get(ConfigService).get<number>('server.port', 4020))
    app.get(SsrRendererService).markReady()
    await app.listen(port, '0.0.0.0')
    logger.log(`Chat Web Skyline 服务启动 [${process.env.NODE_ENV}]：http://127.0.0.1:${port}`)
    return app
}

if (require.main === module) {
    void bootstrap().catch(error => {
        logger.error(error, 'Bootstrap')
        process.exitCode = 1
    })
}
