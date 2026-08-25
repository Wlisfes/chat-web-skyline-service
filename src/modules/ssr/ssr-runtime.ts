import type { IConfig, ISSRContext, UserConfig } from 'ssr-types'

export const SSR_RUNTIME = Symbol('SSR_RUNTIME')

export type SsrRenderOptions = UserConfig & {
    mode: 'ssr' | 'csr'
    stream: false
}

export type SsrRenderFunction = (context: ISSRContext, options: SsrRenderOptions) => Promise<string>

export interface SsrRuntime {
    render: SsrRenderFunction
    loadConfig: () => IConfig
}
