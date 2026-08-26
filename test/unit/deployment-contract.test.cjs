const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { describe, it } = require('node:test')

const read = relativePath => readFileSync(join(process.cwd(), relativePath), 'utf8')

describe('Skyline deployment contract', () => {
    it('builds a non-root production image with SSR readiness healthcheck', () => {
        const dockerfile = read('Dockerfile')

        assert.match(dockerfile, /FROM node:22-alpine AS dependencies/)
        assert.match(dockerfile, /--mount=type=secret,id=github_token,required=true/)
        assert.match(dockerfile, /COPY --from=builder --chown=node:node \/app\/dist \.\/dist/)
        assert.match(dockerfile, /COPY --from=builder --chown=node:node \/app\/build \.\/build/)
        assert.match(dockerfile, /USER node/)
        assert.match(dockerfile, /EXPOSE 4020/)
        assert.match(dockerfile, /health\/ready/)
        assert.match(dockerfile, /CMD \["node", "dist\/main\.js"\]/)
    })

    it('keeps the container on the shared network without publishing host port 4020', () => {
        const compose = read('deploy/compose.yml')

        assert.match(compose, /^name: chat-web-service$/m)
        assert.match(compose, /^\s{4}skyline-service:$/m)
        assert.match(compose, /container_name: chat-web-skyline-service/)
        assert.match(compose, /restart: unless-stopped/)
        assert.match(compose, /driver: json-file/)
        assert.match(compose, /max-size: ['"]20m['"]/)
        assert.match(compose, /max-file: ['"]30['"]/)
        assert.match(compose, /expose:\s*\n\s+- ['"]4020['"]/)
        assert.doesNotMatch(compose, /^\s+ports:$/m)
        assert.match(compose, /external: true/)
        assert.match(compose, /chat-web-infrastructure/)
        assert.match(compose, /\$\{ENV_FILE:-\.env\}/)
    })

    it('deploys one service with health gating and previous-image rollback', () => {
        const deploy = read('deploy/deploy.sh')

        assert.match(deploy, /CONTAINER=chat-web-skyline-service/)
        assert.match(deploy, /old_image=.*docker inspect/)
        assert.match(deploy, /rollback\(\)/)
        assert.match(deploy, /docker pull "\$IMAGE"/)
        assert.match(deploy, /compose up -d --no-deps "\$SERVICE"/)
        assert.match(deploy, /\.State\.Health/)
        assert.match(deploy, /health\/ready/)
        assert.doesNotMatch(deploy, /--remove-orphans/)
    })

    it('builds a full SHA image and deploys it through the Home host runner', () => {
        const workflow = read('.github/workflows/deploy.yml')

        assert.match(workflow, /push:\s*\n\s+branches:\s*\n\s+- main/)
        assert.match(workflow, /GITHUB_SHA/)
        assert.match(workflow, /docker\/build-push-action@v6/)
        assert.match(workflow, /github_token=\$\{\{ secrets\.GITHUB_TOKEN \}\}/)
        assert.match(workflow, /chat-server-home/)
        assert.match(workflow, /production-home/)
        assert.match(workflow, /group: deploy-home/)
        assert.match(workflow, /\/opt\/chat-web-skyline-service/)
        assert.match(workflow, /bootstrap-nacos-config\.cjs/)
        assert.match(workflow, /--volume "\$DEPLOY_PATH\/bootstrap-nacos-config\.cjs:\/opt\/skyline\/bootstrap-nacos-config\.cjs:ro"/)
        assert.match(workflow, /node \/opt\/skyline\/bootstrap-nacos-config\.cjs/)
        assert.doesNotMatch(workflow, /node - < "\$DEPLOY_PATH\/bootstrap-nacos-config\.cjs"/)
        assert.match(workflow, /skyline\.lisfes\.com\/health\/ready/)
        assert.match(workflow, /grep -F ['"]服务端渲染基础框架已就绪['"]/)
        assert.doesNotMatch(workflow, /--remove-orphans/)
    })

    it('uses dynamic Docker DNS for the shared HTTPS ingress', () => {
        const ingress = read('deploy/shared-ingress.conf')

        assert.match(ingress, /server_name skyline\.lisfes\.com/)
        assert.match(ingress, /resolver 127\.0\.0\.11 ipv6=off valid=30s/)
        assert.match(ingress, /set \$skyline_upstream chat-web-skyline-service:4020/)
        assert.match(ingress, /proxy_pass http:\/\/\$skyline_upstream/)
        assert.doesNotMatch(ingress, /^upstream\s+/m)
    })
})
