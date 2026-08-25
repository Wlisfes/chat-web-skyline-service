import type { UserConfig } from 'ssr-types'

const vueLoaderOptions = {
    compilerOptions: {
        isCustomElement: (tag: string) => tag === 'css-render-style' || tag.includes('micro')
    }
}

const userConfig: UserConfig = {
    serverPort: 4020,
    stream: false,
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
