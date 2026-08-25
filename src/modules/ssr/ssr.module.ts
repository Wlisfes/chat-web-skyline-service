import { Global, Module } from '@nestjs/common'
import { loadConfig } from 'ssr-common-utils'
import { render } from 'ssr-core'
import { NaiveStyleInjector } from './naive-style-injector'
import { SsrRendererService } from './ssr-renderer.service'
import { SSR_RUNTIME, type SsrRenderFunction, type SsrRuntime } from './ssr-runtime'

const runtime: SsrRuntime = {
    render: render as SsrRenderFunction,
    loadConfig
}

@Global()
@Module({
    providers: [NaiveStyleInjector, SsrRendererService, { provide: SSR_RUNTIME, useValue: runtime }],
    exports: [SsrRendererService]
})
export class SsrModule {}
