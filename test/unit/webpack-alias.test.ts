import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { userConfig } from '../../config'

describe('Skyline Webpack aliases', () => {
    it('maps aliases and enables Naive UI TSX auto import for client and server builds', () => {
        const aliases = new Map<string, string>()
        const pluginNames: string[] = []
        let rewriteGeneratedAlias: ((resource: { context: string; request: string }) => void) | undefined
        const alias = {
            set(name: string, path: string) {
                aliases.set(name, path)
                return alias
            }
        }
        const plugin = {
            use(_plugin: unknown, options?: [RegExp, (resource: { context: string; request: string }) => void]) {
                if (options) rewriteGeneratedAlias = options[1]
                return plugin
            }
        }

        assert.equal(typeof userConfig.chainBaseConfig, 'function')
        userConfig.chainBaseConfig?.(
            {
                resolve: { alias },
                plugin(name: string) {
                    pluginNames.push(name)
                    return plugin
                }
            } as never,
            false
        )
        assert.equal(aliases.get('@'), resolve(process.cwd(), 'src'))
        assert.equal(aliases.get('@web'), resolve(process.cwd(), 'web'))
        assert.ok(pluginNames.includes('naive-ui-component-auto-import'))

        assert.ok(rewriteGeneratedAlias)
        const generatedResource = { context: resolve(process.cwd(), 'build'), request: '@/pages/index/render.vue' }
        rewriteGeneratedAlias(generatedResource)
        assert.equal(generatedResource.request, '@web/pages/index/render.vue')

        const sourceResource = { context: resolve(process.cwd(), 'src'), request: '@/modules/health/health.module' }
        rewriteGeneratedAlias(sourceResource)
        assert.equal(sourceResource.request, '@/modules/health/health.module')
    })

    it('loads runtime configuration without the build-only Webpack package', () => {
        const script = `
            const Module = require('node:module')
            const originalLoad = Module._load
            Module._load = function (request, ...args) {
                if (request === 'webpack') throw new Error('生产环境不应加载 webpack')
                return originalLoad.call(this, request, ...args)
            }
            require('./config.ts')
        `
        const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], { cwd: process.cwd(), encoding: 'utf8' })

        assert.equal(result.status, 0, result.stderr || result.stdout)
    })
})
