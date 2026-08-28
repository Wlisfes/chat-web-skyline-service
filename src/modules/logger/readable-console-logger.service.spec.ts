import type { RequestLogPayload } from '@wlisfes/chat-web-base-schema/logging'
import { stripVTControlCharacters } from 'node:util'
import { ReadableConsoleLogger } from './readable-console-logger.service'

describe('ReadableConsoleLogger', () => {
    it('将 HTTP 请求对象输出为可读日志', () => {
        const lines: string[] = []
        const write = jest.spyOn(process.stdout, 'write').mockImplementation(value => {
            lines.push(String(value))
            return true
        })
        const logger = new ReadableConsoleLogger({ colors: false, compact: true, prefix: 'chat-web-skyline-service' })
        const payload: RequestLogPayload = {
            message: 'HTTP请求完成',
            service: 'chat-web-skyline-service',
            logId: '34ec4ca9-2abf-49b8-85f6-77d7fd23ea1d',
            requestId: '34ec4ca9-2abf-49b8-85f6-77d7fd23ea1d',
            method: 'POST',
            url: '/api/windows/chunk/enums/select',
            statusCode: 200,
            durationMs: 12,
            ip: '127.0.0.1',
            host: 'skyline.lisfes.com',
            origin: '',
            referer: '',
            userAgent: 'jest',
            query: {},
            params: {},
            body: { xxxx: 'xxxx' }
        }

        try {
            logger.log(payload, 'chat-web-skyline-service:HTTP')
        } finally {
            write.mockRestore()
        }

        expect(lines).toHaveLength(1)
        expect(lines[0]).toContain('服务名称:[chat-web-skyline-service]')
        expect(lines[0]).toContain(`进程ID:[${process.pid}]`)
        expect(lines[0]).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/)
        expect(lines[0]).toContain('[LoggerMiddleware]')
        expect(lines[0]).toContain('日志ID:[34ec4ca9-2abf-49b8-85f6-77d7fd23ea1d]')
        expect(lines[0]).toContain('接口地址:/api/windows/chunk/enums/select')
        expect(lines[0]).toContain('耗时:12ms')
        expect(lines[0]).toContain('"message": "HTTP请求完成"')
        expect(lines[0]).toContain('"service": "chat-web-skyline-service"')
        expect(lines[0]).toContain('"requestId": "34ec4ca9-2abf-49b8-85f6-77d7fd23ea1d"')
        expect(lines[0]).toContain('"durationMs": 12')
        expect(lines[0]).toContain('"xxxx": "xxxx"')
        expect(lines[0]).not.toContain('Object(16)')
    })

    it('请求没有 body 时仍然保留 body 字段', () => {
        const lines: string[] = []
        const write = jest.spyOn(process.stdout, 'write').mockImplementation(value => {
            lines.push(String(value))
            return true
        })
        const logger = new ReadableConsoleLogger({ colors: false, compact: true, prefix: 'chat-web-skyline-service' })
        const payload: RequestLogPayload = {
            message: 'HTTP请求完成',
            service: 'chat-web-skyline-service',
            logId: 'request-without-body',
            requestId: 'request-without-body',
            method: 'GET',
            url: '/',
            statusCode: 200,
            durationMs: 2,
            ip: '127.0.0.1',
            host: '127.0.0.1:4020',
            origin: '',
            referer: '',
            userAgent: 'jest',
            query: {},
            params: {},
            body: undefined
        }

        try {
            logger.log(payload, 'chat-web-skyline-service:HTTP')
        } finally {
            write.mockRestore()
        }

        expect(lines).toHaveLength(1)
        expect(lines[0]).toContain('"body": null')
    })

    it('启用颜色时为请求头和 JSON 字段输出不同颜色', () => {
        const lines: string[] = []
        const write = jest.spyOn(process.stdout, 'write').mockImplementation(value => {
            lines.push(String(value))
            return true
        })
        const logger = new ReadableConsoleLogger({ colors: true, compact: true, prefix: 'chat-web-skyline-service' })
        const payload: RequestLogPayload = {
            message: 'HTTP请求完成',
            service: 'chat-web-skyline-service',
            logId: 'colored-request',
            requestId: 'colored-request',
            method: 'GET',
            url: '/',
            statusCode: 200,
            durationMs: 3,
            ip: '127.0.0.1',
            host: '127.0.0.1:4020',
            origin: '',
            referer: '',
            userAgent: 'jest',
            query: {},
            params: {},
            body: null
        }

        try {
            logger.log(payload, 'chat-web-skyline-service:HTTP')
        } finally {
            write.mockRestore()
        }

        expect(lines).toHaveLength(1)
        expect(lines[0]).toContain('\u001B[95m日志ID:[colored-request]\u001B[39m')
        expect(lines[0]).toContain('\u001B[96m"method"\u001B[39m')
        expect(lines[0]).toContain('\u001B[92m"GET"\u001B[39m')
        expect(lines[0]).toContain('\u001B[93m200\u001B[39m')
        expect(lines[0]).toContain('\u001B[90mnull\u001B[39m')
        expect(stripVTControlCharacters(lines[0])).toContain('"body": null')
    })
})
