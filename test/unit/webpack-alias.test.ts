import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { userConfig } from '../../config'

describe('Skyline Webpack aliases', () => {
    it('maps source and web aliases for client and server builds', () => {
        const aliases = new Map<string, string>()
        let rewriteGeneratedAlias: ((resource: { context: string; request: string }) => void) | undefined
        const alias = {
            set(name: string, path: string) {
                aliases.set(name, path)
                return alias
            }
        }
        const plugin = {
            use(_plugin: unknown, options: [RegExp, (resource: { context: string; request: string }) => void]) {
                rewriteGeneratedAlias = options[1]
                return plugin
            }
        }

        assert.equal(typeof userConfig.chainBaseConfig, 'function')
        userConfig.chainBaseConfig?.({ resolve: { alias }, plugin: () => plugin } as never, false)
        assert.equal(aliases.get('@'), resolve(process.cwd(), 'src'))
        assert.equal(aliases.get('@web'), resolve(process.cwd(), 'web'))

        assert.ok(rewriteGeneratedAlias)
        const generatedResource = { context: resolve(process.cwd(), 'build'), request: '@/pages/index/render.vue' }
        rewriteGeneratedAlias(generatedResource)
        assert.equal(generatedResource.request, '@web/pages/index/render.vue')

        const sourceResource = { context: resolve(process.cwd(), 'src'), request: '@/modules/health/health.module' }
        rewriteGeneratedAlias(sourceResource)
        assert.equal(sourceResource.request, '@/modules/health/health.module')
    })
})
