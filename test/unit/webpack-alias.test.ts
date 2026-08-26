import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { userConfig } from '../../config'

describe('Skyline Webpack aliases', () => {
    it('uses WebSocket HMR without the legacy SockJS unload listener', () => {
        assert.equal(userConfig.webpackDevServerConfig?.transportMode, 'ws')
    })

    it('maps aliases and enables SCSS plus Naive UI TSX auto import for client and server builds', () => {
        type StyleRuleState = { test?: RegExp; uses: string[]; loaders: string[] }
        type StyleRule = {
            test: (value: RegExp) => StyleRule
            when: (condition: boolean, callback: (currentRule: StyleRule) => void) => StyleRule
            use: (name: string) => StyleRule
            loader: (value: string) => StyleRule
            options: () => StyleRule
            end: () => StyleRule
        }

        const aliases = new Map<string, string>()
        const pluginNames: string[] = []
        const styleRules = new Map<string, StyleRuleState>()
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
        const createStyleRule = (name: string) => {
            const state: StyleRuleState = { uses: [], loaders: [] }
            styleRules.set(name, state)
            const rule: StyleRule = {
                test(value: RegExp) {
                    state.test = value
                    return rule
                },
                when(condition: boolean, callback: (currentRule: typeof rule) => void) {
                    if (condition) callback(rule)
                    return rule
                },
                use(name: string) {
                    state.uses.push(name)
                    return rule
                },
                loader(value: string) {
                    state.loaders.push(value)
                    return rule
                },
                options() {
                    return rule
                },
                end() {
                    return rule
                }
            }
            return rule
        }

        assert.equal(typeof userConfig.chainBaseConfig, 'function')
        userConfig.chainBaseConfig?.(
            {
                resolve: { alias },
                module: { rule: createStyleRule },
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
        assert.match('common.scss', styleRules.get('scss')?.test ?? /$^/)
        assert.ok(styleRules.get('scss')?.uses.includes('sass-loader'))
        assert.ok(styleRules.get('scss')?.loaders.some(loader => loader.includes('sass-loader')))

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
