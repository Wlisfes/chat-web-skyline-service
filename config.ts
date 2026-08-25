import type { UserConfig } from 'ssr-types'

const userConfig: UserConfig = {
    serverPort: 4020,
    stream: false,
    whiteList: ['naive-ui', 'vueuc', 'date-fns', '@css-render/vue3-ssr']
}

export { userConfig }
