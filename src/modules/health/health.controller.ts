import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common'
import type { Response } from 'express'
import { HealthService } from './health.service'

@Controller('health')
export class HealthController {
    constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

    @Get('live')
    getLiveness(): { status: 'UP' } {
        return this.healthService.getLiveness()
    }

    @Get('ready')
    getReadiness(@Res({ passthrough: true }) response: Response): ReturnType<HealthService['getReadiness']> {
        const readiness = this.healthService.getReadiness()
        if (readiness.status === 'DOWN') response.status(HttpStatus.SERVICE_UNAVAILABLE)
        return readiness
    }
}
