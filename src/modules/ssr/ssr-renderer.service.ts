import { existsSync } from 'node:fs'
import { Inject, Injectable } from '@nestjs/common'
import type { ISSRContext } from 'ssr-types'
import { NaiveStyleInjector } from './naive-style-injector'
import { SSR_RUNTIME, type SsrRuntime } from './ssr-runtime'

@Injectable()
export class SsrRendererService {
    private bootstrapped = false

    constructor(
        @Inject(SSR_RUNTIME) private readonly runtime: SsrRuntime,
        private readonly styleInjector: NaiveStyleInjector
    ) {}

    async renderSsr(context: ISSRContext): Promise<string> {
        const html = await this.runtime.render(context, { mode: 'ssr', stream: false })
        return this.styleInjector.inject(html)
    }

    renderCsr(context: ISSRContext): Promise<string> {
        return this.runtime.render(context, { mode: 'csr', stream: false })
    }

    markReady(): void {
        this.bootstrapped = true
    }

    isReady(): boolean {
        if (!this.bootstrapped) return false
        const config = this.runtime.loadConfig()
        if (config.isDev) return true
        const { serverBundle, assetManifest, asyncChunkMap } = config.dynamicFile
        return [serverBundle, assetManifest, asyncChunkMap].every(path => existsSync(path))
    }
}
