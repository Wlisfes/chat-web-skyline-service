const test = require('node:test')
const assert = require('node:assert/strict')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const utils = require('../dist/modules/garage/garage.utils.service')
const options = require('../dist/modules/garage/garage.options')

const config = {
    endpoint: 'http://chat-web-garage:3900',
    publicEndpoint: 'https://chat-web-garage.lisfes.cn',
    region: 'garage',
    bucket: 'chat-web',
    accessKeyId: 'GKEXAMPLE',
    secretAccessKey: 'secret-example',
    forcePathStyle: true
}

function messageOf(fn) {
    try {
        fn()
    } catch (error) {
        return error.message
    }
    return ''
}

test('object key rejects traversal and blank values', () => {
    assert.equal(utils.normalizeObjectKey(' healthcheck/public.txt '), 'healthcheck/public.txt')
    assert.equal(messageOf(() => utils.normalizeObjectKey('../secret')).length > 0, true)
    assert.equal(messageOf(() => utils.normalizeObjectKey('/root')).length > 0, true)
    assert.equal(utils.normalizePrefix(''), '')
})

test('aws sdk presigned url uses the public path-style endpoint', async () => {
    const client = options.createGarageClient(config, config.publicEndpoint)
    const url = new URL(
        await getSignedUrl(
            client,
            new PutObjectCommand({
                Bucket: config.bucket,
                Key: 'docs/a b.txt',
                ContentType: 'text/plain'
            }),
            { expiresIn: 900, signableHeaders: new Set(['content-type']) }
        )
    )
    assert.equal(url.origin, 'https://chat-web-garage.lisfes.cn')
    assert.equal(url.pathname, '/chat-web/docs/a%20b.txt')
    assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256')
    assert.equal(url.searchParams.get('X-Amz-Expires'), '900')
    assert.match(url.searchParams.get('X-Amz-SignedHeaders'), /content-type/)
    assert.match(url.searchParams.get('X-Amz-SignedHeaders'), /host/)
    assert.match(url.searchParams.get('X-Amz-Signature'), /^[0-9a-f]{64}$/)
    client.destroy()
})

test('missing credentials are rejected before creating a client', () => {
    const message = messageOf(() => options.createGarageClient({ ...config, accessKeyId: '', secretAccessKey: '' }))
    assert.equal(message.length > 0, true)
})
