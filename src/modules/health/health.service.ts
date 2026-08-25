import { Inject, Injectable } from '@nestjs/common'
import { SsrRendererService } from '../ssr/ssr-renderer.service'

@Injectable()
export class HealthService {
    constructor(@Inject(SsrRendererService) private readonly renderer: SsrRendererService) {}

    getLiveness(): { status: 'UP' } {
        return { status: 'UP' }
    }

    getReadiness(): { status: 'UP' | 'DOWN'; renderer: { ready: boolean } } {
        const ready = this.renderer.isReady()
        return { status: ready ? 'UP' : 'DOWN', renderer: { ready } }
    }
}
