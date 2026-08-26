import { Injectable } from '@nestjs/common'

const COLLECTOR_SOURCE = '<css-render-style\\b[^>]*>([\\s\\S]*?)<\\/css-render-style>'

@Injectable()
export class NaiveStyleInjector {
    inject(html: string): string {
        const matches = Array.from(html.matchAll(new RegExp(COLLECTOR_SOURCE, 'gi')))
        if (matches.length === 0) throw new Error('缺少 css-render-style 样式收集节点')

        const styles = matches.map(match => match[1]).join('\n')
        if (!/<style\b[^>]*\bcssr-id=(['"])[^'"]+\1[^>]*>/i.test(styles)) {
            throw new Error('未收集到 Naive UI cssr-id 样式')
        }

        const htmlWithoutCollectors = html.replace(new RegExp(COLLECTOR_SOURCE, 'gi'), '')
        const headCloseIndex = htmlWithoutCollectors.search(/<\/head\s*>/i)
        if (headCloseIndex < 0) throw new Error('渲染结果缺少 </head>')

        return `${htmlWithoutCollectors.slice(0, headCloseIndex)}${styles}\n${htmlWithoutCollectors.slice(headCloseIndex)}`
    }
}
