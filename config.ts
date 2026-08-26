import { resolve } from 'node:path'
import type { UserConfig } from 'ssr-types'

const PROJECT_ROOT = process.cwd()
const BUILD_ROOT = resolve(PROJECT_ROOT, 'build')

const vueLoaderOptions = {
    compilerOptions: {
        isCustomElement: (tag: string) => tag === 'css-render-style' || tag.includes('micro')
    }
}

const userConfig: UserConfig = {
    serverPort: 4020,
    stream: false,
    webpackDevServerConfig: {
        transportMode: 'ws'
    },
    define: {
        base: {
            // ssr-common-utils 会再次序列化字符串，此处必须保留布尔值供 DefinePlugin 替换
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: (process.env.NODE_ENV !== 'production') as unknown as string
        }
    },
    whiteList: ['naive-ui', 'vueuc', 'date-fns', '@css-render/vue3-ssr'],
    ssrVueLoaderOptions: vueLoaderOptions,
    csrVueLoaderOptions: vueLoaderOptions,
    babelOptions: {
        include: [/node_modules[\\/](?:naive-ui|date-fns)(?:[\\/]|$)/]
    },
    css: () => ({
        loaderOptions: {
            sass: {
                sassOptions: {
                    silenceDeprecations: ['legacy-js-api']
                }
            }
        }
    }),
    chainBaseConfig(config, isServer) {
        const { NormalModuleReplacementPlugin } = require('webpack')
        const { setStyle } = require('ssr-common-utils')
        const Components = require('unplugin-vue-components/webpack')
        const { NaiveUiResolver } = require('unplugin-vue-components/resolvers')

        config.resolve.alias.set('@', resolve(PROJECT_ROOT, 'src')).set('@web', resolve(PROJECT_ROOT, 'web'))
        setStyle(config, /\.s[ac]ss$/, {
            rule: 'scss',
            loader: 'sass-loader',
            importLoaders: 2,
            isServer
        })
        config.plugin('naive-ui-component-auto-import').use(
            Components({
                dts: false,
                dirs: [resolve(PROJECT_ROOT, 'web/components/common')],
                extensions: ['vue'],
                deep: true,
                resolvers: [NaiveUiResolver()]
            })
        )
        config.plugin('skyline-generated-web-alias').use(NormalModuleReplacementPlugin, [
            /^@\//,
            (resource: { context: string; request: string }) => {
                if (resolve(resource.context) === BUILD_ROOT) resource.request = resource.request.replace(/^@\//, '@web/')
            }
        ])
    },
    chainServerConfig(config) {
        config.module.rule('compileBabelForExtraModule').test(/\.(?:cjs|js|mjs|jsx|ts|tsx)$/)
    }
}

export { userConfig }
