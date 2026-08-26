import type { IWindow } from 'ssr-types'

declare global {
    interface Window extends IWindow {}
    const __isBrowser__: boolean
}

declare module '*.less'
declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
    export default component
}

export {}
