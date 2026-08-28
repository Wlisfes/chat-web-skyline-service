import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { setupSwagger } from '@wlisfes/chat-web-base-schema'
import { createRequestLoggingMiddleware } from '@wlisfes/chat-web-base-schema/logging'
import { requestContextMiddleware } from '@wlisfes/chat-web-base-schema/request-context'
import { AppModule } from '@/app.module'
import { ReadableConsoleLogger } from '@/modules/logger/readable-console-logger.service'

const isProduction = process.env.NODE_ENV === 'production'
const logger = new ReadableConsoleLogger({
    compact: true,
    colors: !isProduction,
    prefix: process.env.NACOS_SERVICE_NAME,
    json: isProduction
})
async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger })
    app.enableShutdownHooks()
    app.use(requestContextMiddleware)
    app.use(
        createRequestLoggingMiddleware({
            serviceName: process.env.NACOS_SERVICE_NAME,
            ignoredPaths: ['/health/live', '/.well-known/appspecific/com.chrome.devtools.json']
        })
    )
    await app.init()

    return await setupSwagger(app, {
        title: `Chat Web Skyline 服务 API`,
        description: `Chat Web Skyline 服务接口文档`,
        port: process.env.PORT,
        NODE_ENV: process.env.NODE_ENV ?? 'development'
    }).then(async event => {
        logger.log(`Chat Web 天线基础服务启动[${event.NODE_ENV}]：http://127.0.0.1:${event.port}`, 'Bootstrap')
        logger.log(`Swagger 文档：http://127.0.0.1:${event.port}/api/swagger`, 'Bootstrap')
    })
}

void bootstrap().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    logger.error(message, stack, 'Bootstrap')
    process.exitCode = 1
})
