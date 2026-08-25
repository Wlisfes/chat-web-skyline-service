import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { NaiveStyleInjector } from '../../src/modules/ssr/naive-style-injector'

const injector = new NaiveStyleInjector()

describe('NaiveStyleInjector', () => {
    it('moves one collected cssr style into head and removes the placeholder', () => {
        const input =
            '<html><head><title>x</title></head><body><main>x</main><css-render-style><style cssr-id="button">.n-button{color:red}</style></css-render-style></body></html>'
        const output = injector.inject(input)

        assert.match(output, /<head><title>x<\/title><style cssr-id="button">/)
        assert.doesNotMatch(output, /css-render-style/)
        assert.equal(output.indexOf('<style cssr-id="button">') < output.indexOf('</head>'), true)
    })

    it('collects multiple placeholders and style blocks', () => {
        const input =
            '<html><head></head><body><css-render-style><style cssr-id="a">a{}</style></css-render-style><css-render-style><style cssr-id="b">b{}</style></css-render-style></body></html>'
        const output = injector.inject(input)

        assert.match(output, /cssr-id="a"/)
        assert.match(output, /cssr-id="b"/)
        assert.doesNotMatch(output, /css-render-style/)
    })

    it('rejects HTML without a collector placeholder', () => {
        assert.throws(() => injector.inject('<html><head></head><body></body></html>'), /缺少 css-render-style 样式收集节点/)
    })

    it('rejects a collector that contains no cssr-id style', () => {
        assert.throws(
            () => injector.inject('<html><head></head><body><css-render-style></css-render-style></body></html>'),
            /未收集到 Naive UI cssr-id 样式/
        )
    })

    it('rejects HTML without a closing head tag', () => {
        assert.throws(
            () => injector.inject('<html><body><css-render-style><style cssr-id="a">a{}</style></css-render-style></body></html>'),
            /缺少 <\/head>/
        )
    })
})
