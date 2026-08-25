import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { SkylineController } from '../../src/modules/skyline/skyline.controller'
import { SsrRendererService } from '../../src/modules/ssr/ssr-renderer.service'

describe('SkylineController', () => {
    let app: INestApplication | undefined

    afterEach(async () => {
        await app?.close()
    })

    async function createApp(renderer: Pick<SsrRendererService, 'renderSsr' | 'renderCsr'>) {
        const moduleRef = await Test.createTestingModule({
            controllers: [SkylineController],
            providers: [{ provide: SsrRendererService, useValue: renderer }]
        }).compile()
        app = moduleRef.createNestApplication()
        await app.init()
        return app
    }

    it('returns an SSR response and mode header', async () => {
        const renderer = {
            renderSsr: mock.fn(async () => '<!DOCTYPE html><html><body>SSR Skyline</body></html>'),
            renderCsr: mock.fn(async () => '')
        }
        const testApp = await createApp(renderer)

        const response = await request(testApp.getHttpServer()).get('/').expect(200)

        assert.equal(response.headers['x-render-mode'], 'ssr')
        assert.match(response.text, /SSR Skyline/)
        assert.equal(renderer.renderSsr.mock.callCount(), 1)
        assert.equal(renderer.renderCsr.mock.callCount(), 0)
    })

    it('falls back to CSR exactly once after an SSR error', async () => {
        const renderer = {
            renderSsr: mock.fn(async () => {
                throw new Error('ssr failed')
            }),
            renderCsr: mock.fn(async () => '<!DOCTYPE html><html><body><div id="app"></div></body></html>')
        }
        const testApp = await createApp(renderer)

        const response = await request(testApp.getHttpServer()).get('/').expect(200)

        assert.equal(response.headers['x-render-mode'], 'csr')
        assert.match(response.text, /id="app"/)
        assert.equal(renderer.renderSsr.mock.callCount(), 1)
        assert.equal(renderer.renderCsr.mock.callCount(), 1)
    })

    it('returns a generic 500 when SSR and CSR both fail', async () => {
        const renderer = {
            renderSsr: mock.fn(async () => {
                throw new Error('internal-ssr-stack')
            }),
            renderCsr: mock.fn(async () => {
                throw new Error('internal-csr-stack')
            })
        }
        const testApp = await createApp(renderer)

        const response = await request(testApp.getHttpServer()).get('/').expect(500)

        assert.match(response.text, /页面暂时无法加载/)
        assert.doesNotMatch(response.text, /internal-ssr-stack|internal-csr-stack/)
        assert.equal(renderer.renderSsr.mock.callCount(), 1)
        assert.equal(renderer.renderCsr.mock.callCount(), 1)
    })
})
