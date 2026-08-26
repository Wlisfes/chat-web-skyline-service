import { Controller, Get, HttpStatus, Inject, Logger, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { ISSRNestContext } from 'ssr-types'
import { SsrRendererService } from '../ssr/ssr-renderer.service'

const ERROR_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#07111f" />
        <meta name="color-scheme" content="dark" />
        <title>页面暂时无法加载 · Skyline</title>
        <style>
            :root {
                color: #f7fbff;
                background: #07111f;
                font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            * {
                box-sizing: border-box;
            }

            body {
                min-width: 320px;
                min-height: 100vh;
                margin: 0;
                overflow-x: hidden;
                background:
                    radial-gradient(circle at 12% 12%, rgba(57, 189, 248, 0.2), transparent 30rem),
                    radial-gradient(circle at 86% 90%, rgba(139, 92, 246, 0.16), transparent 28rem),
                    linear-gradient(145deg, #07111f 0%, #0b1728 48%, #11192b 100%);
            }

            body::before {
                position: fixed;
                inset: 0;
                pointer-events: none;
                content: "";
                opacity: 0.2;
                background-image: repeating-linear-gradient(115deg, transparent 0 3px, rgba(255, 255, 255, 0.025) 3px 4px);
                mask-image: linear-gradient(to bottom, #000, transparent 82%);
            }

            .error-shell {
                display: grid;
                min-height: 100vh;
                place-items: center;
                padding: clamp(20px, 5vw, 64px);
            }

            .error-card {
                display: grid;
                width: min(1040px, 100%);
                min-height: 570px;
                overflow: hidden;
                grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.92fr);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 28px;
                background: rgba(7, 17, 31, 0.72);
                box-shadow: 0 38px 100px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.06);
                backdrop-filter: blur(18px);
            }

            .artwork {
                position: relative;
                min-height: 440px;
                overflow: hidden;
                isolation: isolate;
                background:
                    radial-gradient(circle at 66% 26%, rgba(253, 224, 157, 0.22), transparent 16rem),
                    linear-gradient(155deg, #123c58 0%, #17455d 28%, #3d4b6d 57%, #18263c 100%);
            }

            .artwork::before,
            .artwork::after {
                position: absolute;
                z-index: -1;
                content: "";
                filter: blur(24px);
                border-radius: 50%;
            }

            .artwork::before {
                top: 8%;
                left: -18%;
                width: 72%;
                height: 28%;
                opacity: 0.82;
                background: linear-gradient(90deg, rgba(64, 206, 220, 0.7), rgba(77, 113, 188, 0.18));
                transform: rotate(-12deg);
            }

            .artwork::after {
                right: -20%;
                bottom: 12%;
                width: 78%;
                height: 30%;
                opacity: 0.62;
                background: linear-gradient(100deg, rgba(250, 171, 111, 0.12), rgba(120, 91, 187, 0.64));
                transform: rotate(8deg);
            }

            .sun {
                position: absolute;
                top: 17%;
                right: 14%;
                width: clamp(92px, 12vw, 142px);
                aspect-ratio: 1;
                border-radius: 50%;
                background: linear-gradient(145deg, #fff3bf, #ffc778 68%, #ef956d);
                box-shadow: 0 0 72px rgba(255, 199, 120, 0.36), inset -14px -12px 30px rgba(185, 82, 65, 0.16);
            }

            .status-code {
                position: absolute;
                top: 38px;
                left: 42px;
                color: rgba(255, 255, 255, 0.72);
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.28em;
            }

            .horizon {
                position: absolute;
                right: 0;
                bottom: 0;
                left: 0;
                height: 36%;
                background: linear-gradient(to bottom, rgba(8, 18, 34, 0.05), #091321 48%);
            }

            .city {
                position: absolute;
                right: 7%;
                bottom: 13%;
                left: 7%;
                display: flex;
                height: 40%;
                align-items: flex-end;
                gap: clamp(7px, 1.2vw, 14px);
            }

            .city span {
                position: relative;
                width: 15%;
                height: var(--height);
                border-radius: 4px 4px 0 0;
                background: linear-gradient(165deg, rgba(28, 50, 73, 0.96), rgba(5, 13, 24, 0.98));
                box-shadow: inset 1px 0 rgba(255, 255, 255, 0.05), 0 12px 24px rgba(0, 0, 0, 0.24);
            }

            .city span::before {
                position: absolute;
                inset: 16% 22%;
                content: "";
                opacity: 0.5;
                background: repeating-linear-gradient(to bottom, #ffc77d 0 3px, transparent 3px 13px);
                mask-image: linear-gradient(to right, #000 0 22%, transparent 22% 42%, #000 42% 64%, transparent 64% 80%, #000 80%);
            }

            .message {
                display: flex;
                padding: clamp(42px, 6vw, 76px);
                flex-direction: column;
                justify-content: center;
            }

            .eyebrow {
                margin: 0 0 22px;
                color: #7dd3fc;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.24em;
            }

            h1 {
                max-width: 10em;
                margin: 0;
                font-size: clamp(34px, 4.6vw, 58px);
                font-weight: 650;
                letter-spacing: -0.045em;
                line-height: 1.08;
            }

            .description {
                max-width: 32em;
                margin: 24px 0 0;
                color: #a9b8ca;
                font-size: 16px;
                line-height: 1.8;
            }

            .actions {
                display: flex;
                margin-top: 38px;
                align-items: center;
                gap: 18px;
            }

            .primary-action {
                display: inline-flex;
                min-height: 46px;
                padding: 0 24px;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(255, 255, 255, 0.16);
                border-radius: 12px;
                color: #07111f;
                background: linear-gradient(135deg, #bae6fd, #7dd3fc);
                box-shadow: 0 12px 32px rgba(14, 165, 233, 0.22);
                font-size: 14px;
                font-weight: 700;
                text-decoration: none;
                transition: transform 160ms ease, box-shadow 160ms ease;
            }

            .primary-action:hover {
                box-shadow: 0 16px 38px rgba(14, 165, 233, 0.32);
                transform: translateY(-2px);
            }

            .primary-action:focus-visible {
                outline: 3px solid rgba(125, 211, 252, 0.38);
                outline-offset: 4px;
            }

            .hint {
                color: #71839a;
                font-size: 12px;
            }

            @media (max-width: 760px) {
                .error-card {
                    min-height: 0;
                    grid-template-columns: 1fr;
                }

                .artwork {
                    min-height: 300px;
                }

                .message {
                    padding: 42px 30px 48px;
                }

                h1 {
                    max-width: none;
                }
            }

            @media (max-width: 420px) {
                .error-shell {
                    padding: 12px;
                }

                .error-card {
                    border-radius: 20px;
                }

                .artwork {
                    min-height: 250px;
                }

                .status-code {
                    top: 26px;
                    left: 26px;
                }

                .actions {
                    align-items: flex-start;
                    flex-direction: column;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .primary-action {
                    transition: none;
                }
            }
        </style>
    </head>
    <body>
        <main class="error-shell">
            <section class="error-card" aria-labelledby="error-title">
                <div class="artwork" aria-hidden="true">
                    <span class="status-code">ERROR · 500</span>
                    <span class="sun"></span>
                    <span class="horizon"></span>
                    <div class="city">
                        <span style="--height: 42%"></span>
                        <span style="--height: 68%"></span>
                        <span style="--height: 54%"></span>
                        <span style="--height: 88%"></span>
                        <span style="--height: 62%"></span>
                        <span style="--height: 76%"></span>
                    </div>
                </div>
                <div class="message">
                    <p class="eyebrow">CHAT WEB · SKYLINE</p>
                    <h1 id="error-title">页面暂时无法加载</h1>
                    <p class="description">云层偶尔也会遮住天际线。服务遇到了一点短暂波动，请稍后重新加载。</p>
                    <div class="actions">
                        <a class="primary-action" href="/">重新加载</a>
                        <span class="hint">HTTP 500 · 服务暂时不可用</span>
                    </div>
                </div>
            </section>
        </main>
    </body>
</html>`

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
            try {
                this.logger.error({ message: 'Skyline SSR 渲染失败，准备降级 CSR', path: request.path, error: this.errorMessage(error) })
                const html = await this.renderer.renderCsr(context)
                return this.sendHtml(response, HttpStatus.OK, 'csr', html)
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
