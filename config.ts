import type { UserConfig } from 'ssr-types'

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
    chainServerConfig(config) {
        config.module.rule('compileBabelForExtraModule').test(/\.(?:cjs|js|mjs|jsx|ts|tsx)$/)
    }
}

export { userConfig }
