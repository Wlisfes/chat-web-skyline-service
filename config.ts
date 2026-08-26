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
    chainBaseConfig(config) {
        const { NormalModuleReplacementPlugin } = require('webpack')
        config.resolve.alias.set('@', resolve(PROJECT_ROOT, 'src')).set('@web', resolve(PROJECT_ROOT, 'web'))
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
