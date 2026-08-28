import { ConsoleLogger, type ConsoleLoggerOptions, type LogLevel } from '@nestjs/common'
import type { RequestLogPayload } from '@wlisfes/chat-web-base-schema/logging'
import { styleText } from 'node:util'

type TerminalColor = Parameters<typeof styleText>[0]
type ReadableConsoleLoggerOptions = ConsoleLoggerOptions & {
    compactRequestJson?: boolean
}

const JSON_TOKEN_PATTERN = /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

function colorText(colors: boolean, color: TerminalColor, value: string): string {
    return colors ? styleText(color, value, { validateStream: false }) : value
}

function colorHex(colors: boolean, color: string, value: string): string {
    if (!colors) return value

    const [red, green, blue] = color.match(/[\da-fA-F]{2}/g)?.map(channel => Number.parseInt(channel, 16)) ?? []
    if ([red, green, blue].some(channel => channel === undefined)) return value
    return `\u001B[38;2;${red};${green};${blue}m${value}\u001B[39m`
}

function colorJson(json: string, colors: boolean): string {
    if (!colors) return json

    return json.replace(JSON_TOKEN_PATTERN, (token, quoted: string | undefined, colon: string | undefined) => {
        if (quoted && colon) return `${colorText(true, 'cyanBright', quoted)}${colon}`
        if (quoted) return colorText(true, 'greenBright', quoted)
        if (token === 'null') return colorText(true, 'gray', token)
        if (token === 'true' || token === 'false') return colorText(true, 'magentaBright', token)
        return colorText(true, 'yellowBright', token)
    })
}

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

function createRequestLogDetails(payload: RequestLogPayload) {
    return {
        message: payload.message,
        service: payload.service,
        logId: payload.logId,
        method: payload.method,
        url: payload.url,
        statusCode: payload.statusCode,
        durationMs: payload.durationMs,
        ip: payload.ip,
        host: payload.host,
        origin: payload.origin,
        referer: payload.referer,
        userAgent: payload.userAgent,
        query: payload.query,
        params: payload.params,
        body: payload.body ?? null,
        ...(payload.traceId ? { traceId: payload.traceId } : {}),
        ...(payload.spanId ? { spanId: payload.spanId } : {})
    }
}

function formatRequestLogDetails(payload: RequestLogPayload, colors: boolean, compact: boolean): string {
    return colorJson(JSON.stringify(createRequestLogDetails(payload), null, compact ? undefined : 4), colors)
}

function formatTimestamp(date: Date): string {
    const parts = new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date)
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0')

    return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}.${milliseconds}`
}

/** 保留 NestJS ConsoleLogger 行为，只改善 HTTP 请求对象在控制台和 Dozzle 中的可读性。 */
export class ReadableConsoleLogger extends ConsoleLogger {
    private readonly compactRequestJson: boolean

    constructor(options: ReadableConsoleLoggerOptions) {
        super(options)
        this.compactRequestJson = options.compactRequestJson === true
    }

    protected override stringifyMessage(message: unknown, logLevel: LogLevel): string {
        if (isRequestLogPayload(message)) {
            return formatRequestLogDetails(message, this.options.colors === true, this.compactRequestJson)
        }
        return super.stringifyMessage(message, logLevel)
    }

    protected override formatMessage(
        logLevel: LogLevel,
        message: unknown,
        _pidMessage: string,
        _formattedLogLevel: string,
        contextMessage: string,
        timestampDiff: string
    ): string {
        const requestLog = isRequestLogPayload(message) ? message : undefined
        const header = this.formatReadableHeader(logLevel, contextMessage, requestLog, this.options.colors === true, this.getTimestamp())
        const content = this.stringifyMessage(message, logLevel)

        return `${header}  ${content}${timestampDiff}\n`
    }

    protected override getTimestamp(): string {
        return formatTimestamp(new Date())
    }

    protected override formatContext(context: string): string {
        return context.endsWith(':HTTP') ? 'LoggerMiddleware' : context
    }

    private formatReadableHeader(
        logLevel: LogLevel,
        executionMethod: string,
        requestLog: RequestLogPayload | undefined,
        colors: boolean,
        timestamp: string
    ): string {
        const serviceName = colorText(colors, 'greenBright', `服务名称:[${this.options.prefix ?? 'Nest'}]`)
        const processId = colorHex(colors, '#fc5404', `进程ID:[${process.pid}]`)
        const time = colorHex(colors, '#fb9300', timestamp)
        const levelName = logLevel === 'log' ? 'INFO' : logLevel.toUpperCase()
        const level = colorText(colors, logLevel === 'error' || logLevel === 'fatal' ? 'redBright' : 'greenBright', levelName)
        const logId = requestLog ? colorHex(colors, '#536dfe', `日志ID:[${requestLog.logId}]`) : ''
        const method = executionMethod ? colorHex(colors, '#ff3d68', `执行方法:[${executionMethod}]`) : ''
        const url = requestLog ? colorHex(colors, '#fc5404', `接口地址:[${requestLog.url}]`) : ''
        const duration = requestLog ? colorHex(colors, '#ff3d68', `耗时:${requestLog.durationMs}ms`) : ''

        return [serviceName, processId, time, level, logId, method, url, duration].filter(Boolean).join('  ')
    }
}
