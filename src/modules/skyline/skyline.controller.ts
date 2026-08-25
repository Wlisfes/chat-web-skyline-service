import { Controller, Get, HttpStatus, Inject, Logger, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { ISSRNestContext } from 'ssr-types'
import { SsrRendererService } from '../ssr/ssr-renderer.service'

const ERROR_PAGE =
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>Skyline</title></head><body><main><h1>页面暂时无法加载</h1><p>请稍后重试。</p></main></body></html>'

@Controller()
export class SkylineController {
    private readonly logger = new Logger(SkylineController.name)

    constructor(@Inject(SsrRendererService) private readonly renderer: SsrRendererService) {}

    @Get('/')
    async renderIndex(@Req() request: Request, @Res() response: Response): Promise<void> {
        const context: ISSRNestContext = { request, response }
        try {
            const html = await this.renderer.renderSsr(context)
            this.sendHtml(response, HttpStatus.OK, 'ssr', html)
        } catch (error) {
            this.logger.error({
                message: 'Skyline SSR 渲染失败，准备降级 CSR',
                path: request.path,
                error: this.errorMessage(error)
            })
            try {
                const html = await this.renderer.renderCsr(context)
                this.sendHtml(response, HttpStatus.OK, 'csr', html)
            } catch (fallbackError) {
                this.logger.error({
                    message: 'Skyline CSR 降级失败',
                    path: request.path,
                    error: this.errorMessage(fallbackError)
                })
                response.status(HttpStatus.INTERNAL_SERVER_ERROR).type('html').send(ERROR_PAGE)
            }
        }
    }

    private sendHtml(response: Response, status: number, mode: 'ssr' | 'csr', html: string): void {
        response.status(status).setHeader('X-Render-Mode', mode)
        response.type('html').send(html)
    }

    private errorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error)
    }
}
