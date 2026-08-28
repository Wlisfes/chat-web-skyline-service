import { ConsoleLogger, type ConsoleLoggerOptions, type LogLevel } from '@nestjs/common'
import type { RequestLogPayload } from '@wlisfes/chat-web-base-schema/logging'

function isRequestLogPayload(message: unknown): message is RequestLogPayload {
    if (!message || typeof message !== 'object') return false

    const payload = message as Partial<RequestLogPayload>
    return (
        payload.message === 'HTTP请求完成' &&
        typeof payload.logId === 'string' &&
        typeof payload.url === 'string' &&
        typeof payload.durationMs === 'number'
    )
}

function formatRequestLogPayload(payload: RequestLogPayload): string {
    const details = {
        method: payload.method,
        statusCode: payload.statusCode,
        ip: payload.ip,
        host: payload.host,
        origin: payload.origin,
        referer: payload.referer,
        userAgent: payload.userAgent,
        query: payload.query,
        params: payload.params,
        body: payload.body,
        ...(payload.traceId ? { traceId: payload.traceId } : {}),
        ...(payload.spanId ? { spanId: payload.spanId } : {})
    }

    return `日志ID:[${payload.logId}]  接口地址:${payload.url}  耗时:${payload.durationMs}ms  ${JSON.stringify(details, null, 4)}`
}

/** 保留 NestJS ConsoleLogger 行为，只改善 HTTP 请求对象在控制台和 Dozzle 中的可读性。 */
export class ReadableConsoleLogger extends ConsoleLogger {
    constructor(options: ConsoleLoggerOptions) {
        super(options)
    }

    protected override stringifyMessage(message: unknown, logLevel: LogLevel): string {
        if (isRequestLogPayload(message)) return formatRequestLogPayload(message)
        return super.stringifyMessage(message, logLevel)
    }

    protected override formatPid(pid: number): string {
        return `服务名称:[${this.options.prefix ?? 'Nest'}] 进程ID:[${pid}]  `
    }

    protected override getTimestamp(): string {
        const now = new Date()
        const parts = new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(now)
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
        const milliseconds = now.getMilliseconds().toString().padStart(3, '0')

        return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}.${milliseconds}`
    }

    protected override formatContext(context: string): string {
        return super.formatContext(context.endsWith(':HTTP') ? 'LoggerMiddleware' : context)
    }
}
