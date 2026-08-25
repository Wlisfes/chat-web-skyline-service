import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { IConfig, ISSRContext } from 'ssr-types'
import { NaiveStyleInjector } from '../../src/modules/ssr/naive-style-injector'
import { SsrRendererService } from '../../src/modules/ssr/ssr-renderer.service'
import type { SsrRenderOptions, SsrRuntime } from '../../src/modules/ssr/ssr-runtime'

function config(isDev: boolean, paths = ['server.js', 'manifest.json', 'chunks.json']): IConfig {
    return {
        isDev,
        dynamicFile: { serverBundle: paths[0], assetManifest: paths[1], asyncChunkMap: paths[2] }
    } as IConfig
}

describe('SsrRendererService', () => {
    it('renders non-streaming SSR and injects collected styles', async () => {
        let options: SsrRenderOptions | undefined
        const runtime: SsrRuntime = {
            render: async (_ctx, nextOptions) => {
                options = nextOptions
                return '<html><head></head><body><div>Skyline</div><css-render-style><style cssr-id="card">.n-card{}</style></css-render-style></body></html>'
            },
            loadConfig: () => config(true)
        }
        const service = new SsrRendererService(runtime, new NaiveStyleInjector())

        const html = await service.renderSsr({} as ISSRContext)

        assert.deepEqual(options, { mode: 'ssr', stream: false })
        assert.match(html, /<head><style cssr-id="card">/)
        assert.doesNotMatch(html, /css-render-style/)
    })

    it('renders CSR once without requiring a style collector', async () => {
        let options: SsrRenderOptions | undefined
        const runtime: SsrRuntime = {
            render: async (_ctx, nextOptions) => {
                options = nextOptions
                return '<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>'
            },
            loadConfig: () => config(true)
        }
        const service = new SsrRendererService(runtime, new NaiveStyleInjector())

        const html = await service.renderCsr({} as ISSRContext)

        assert.deepEqual(options, { mode: 'csr', stream: false })
        assert.match(html, /id="app"/)
    })

    it('is unready before bootstrap and ready in development after bootstrap', () => {
        const runtime: SsrRuntime = { render: async () => '', loadConfig: () => config(true) }
        const service = new SsrRendererService(runtime, new NaiveStyleInjector())

        assert.equal(service.isReady(), false)
        service.markReady()
        assert.equal(service.isReady(), true)
    })

    it('requires all production artifacts after bootstrap', () => {
        const runtime: SsrRuntime = {
            render: async () => '',
            loadConfig: () => config(false, ['Z:/missing/server.js', 'Z:/missing/manifest.json', 'Z:/missing/chunks.json'])
        }
        const service = new SsrRendererService(runtime, new NaiveStyleInjector())

        service.markReady()
        assert.equal(service.isReady(), false)
    })
})
