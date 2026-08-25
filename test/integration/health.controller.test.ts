import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { HealthController } from '../../src/modules/health/health.controller'
import { HealthService } from '../../src/modules/health/health.service'
import { SsrRendererService } from '../../src/modules/ssr/ssr-renderer.service'

describe('health HTTP endpoints', () => {
    let app: INestApplication | undefined

    afterEach(async () => {
        await app?.close()
    })

    async function createApp(ready: boolean): Promise<INestApplication> {
        const moduleRef = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [HealthService, { provide: SsrRendererService, useValue: { isReady: () => ready } }]
        }).compile()
        app = moduleRef.createNestApplication()
        await app.init()
        return app
    }

    it('returns 200 for liveness without checking external services', async () => {
        const testApp = await createApp(false)
        const response = await request(testApp.getHttpServer()).get('/health/live').expect(200)
        assert.equal(response.body.status, 'UP')
    })

    it('returns 200 when the SSR renderer is ready', async () => {
        const testApp = await createApp(true)
        const response = await request(testApp.getHttpServer()).get('/health/ready').expect(200)
        assert.deepEqual(response.body, { status: 'UP', renderer: { ready: true } })
    })

    it('returns 503 when the SSR renderer is not ready', async () => {
        const testApp = await createApp(false)
        const response = await request(testApp.getHttpServer()).get('/health/ready').expect(503)
        assert.deepEqual(response.body, { status: 'DOWN', renderer: { ready: false } })
    })
})
