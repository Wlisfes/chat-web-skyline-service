import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { setupSwagger } from '@wlisfes/chat-web-base-schema'
import { createRequestLoggingMiddleware } from '@wlisfes/chat-web-base-schema/logging'
import { requestContextMiddleware } from '@wlisfes/chat-web-base-schema/request-context'
import { AppModule } from '@/app.module'

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: ['log', 'error', 'warn', 'fatal', 'verbose', 'debug']
    })
    app.enableShutdownHooks()
    app.use(requestContextMiddleware)
    app.use(createRequestLoggingMiddleware({ serviceName: process.env.NACOS_SERVICE_NAME }))
    return await setupSwagger(app, {
        title: `Chat Web 天线基础服务 API`,
        description: `Chat Web 账号、用户及身份信息管理接口文档`,
        port: process.env.NODE_PORT,
        NODE_ENV: process.env.NODE_ENV ?? 'development'
    }).then(async event => {
        console.log(`Chat Web 天线基础服务启动[${event.NODE_ENV}]：http://127.0.0.1:${event.port}`, 'Bootstrap')
        console.log(`Swagger 文档：http://127.0.0.1:${event.port}/api/swagger`, 'Bootstrap')
    })
}

void bootstrap().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error(message, stack, 'Bootstrap')
    process.exitCode = 1
})
