# Chat Web Skyline Service Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independently installable NestJS 11 + Vue3 + Naive UI SSR service on port 4020, with deterministic Naive UI server styles, one-shot CSR fallback, health endpoints, Nacos-first configuration, and no database or Redis connection.

**Architecture:** Use the published `ssr` 6.2 NestJS/Vue3 layout and its Webpack 4 build chain in one NestJS process. Keep HTTP handling, framework rendering, Naive UI style extraction, health state, and Nacos bootstrap decisions in separate focused modules; tests inject a small SSR runtime adapter so failure and fallback behavior are deterministic. Production uses the shared Schema Nacos and logging modules, while tests and explicit offline runs skip Nacos before Nest module construction.

**Tech Stack:** Node.js 20+, Yarn 1.22, TypeScript 5.7, NestJS 11, Vue 3.5, Pinia 2, Naive UI 2.45, `ssr` 6.2, Webpack 4, `@css-render/vue3-ssr`, `@wlisfes/chat-web-base-schema` 1.4.6, Node test runner through `tsx`, Supertest, Playwright.

---

## File map

- `package.json`, `yarn.lock`, `.npmrc`: exact dependency and command baseline; the private package token stays outside the repository.
- `tsconfig.json`, `tsconfig.build.json`, `.prettierrc`, `.gitignore`: shared TypeScript, formatting, and generated-file boundaries.
- `config.ts`: `ssr` framework port, non-streaming mode, and server-bundle allow-list.
- `src/config/nacos-config.ts`: strict default-on Nacos switch used before Nest module construction.
- `src/modules/ssr/naive-style-injector.ts`: pure Naive UI collector extraction and `<head>` injection.
- `src/modules/ssr/ssr-renderer.service.ts`: the only wrapper around `ssr-core`, including SSR/CSR modes and readiness state.
- `src/modules/ssr/ssr.module.ts`: SSR runtime dependency injection boundary.
- `src/modules/health/*`: process liveness and SSR readiness endpoints.
- `src/modules/skyline/*`: root page HTTP response, render-mode header, one-shot fallback, and generic 500 page.
- `src/app.module.ts`, `src/main.ts`: application composition, shared logging, static resources, Nacos-first bootstrap, and listener startup.
- `web/components/layout/*`: SSR document shell and per-request CSS Render collector.
- `web/pages/index/*`, `web/store/index.ts`, `web/common.less`: deterministic technical validation page and Hydration counter.
- `web/@types/global.d.ts`: framework compile-time globals and style module declarations.
- `scripts/verify-build.cjs`: rejects false-positive `ssr build` exits when required artifacts are absent.
- `test/unit/*`: pure Nacos, style-injection, renderer, and build-verifier tests.
- `test/integration/*`: Nest HTTP behavior and real production-artifact HTTP verification.
- `test/e2e/home.spec.ts`, `playwright.config.ts`: real Chromium Hydration and console verification.
- `.env.example`, `README.md`, `AGENTS.md`: safe configuration, operating instructions, data boundaries, and future dual-machine deployment rules.

## Execution rule

All implementation work starts from the approved `main` baseline and remains on `developer`; do not create Docker, Compose, Actions, Runner, or `deploy/` files in this plan.

### Task 1: Create the development branch and reproducible project baseline

**Files:**

- Create: `package.json`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `.prettierrc`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `AGENTS.md`
- Create through install: `yarn.lock`

- [ ] **Step 1: Create `developer` from the approved `main` baseline**

Run:

```bash
git switch -c developer
git branch --show-current
```

Expected: the last command prints `developer`.

- [ ] **Step 2: Add the exact dependency and command baseline**

Create `package.json`:

```json
{
  "name": "chat-web-skyline-service",
  "version": "0.1.0",
  "private": true,
  "license": "UNLICENSED",
  "engines": {
    "node": ">=20",
    "yarn": ">=1.22 <2"
  },
  "scripts": {
    "start": "ssr start",
    "dev": "ssr start",
    "build": "ssr build",
    "start:prod": "cross-env NODE_ENV=production node dist/main.js",
    "typecheck": "tsc -p tsconfig.build.json --noEmit && vue-tsc -p tsconfig.json --noEmit",
    "test:unit": "cross-env NACOS_CONFIG_ENABLED=false tsx --test test/unit/*.test.ts",
    "test:integration": "cross-env NACOS_CONFIG_ENABLED=false tsx --test --test-concurrency=1 test/integration/*.test.ts",
    "test": "yarn format:check && yarn typecheck && yarn test:unit && yarn build && yarn test:integration",
    "test:e2e": "yarn build && playwright test",
    "format": "prettier --write \"{src,web,test,scripts}/**/*.{ts,vue,less,cjs}\" \"*.{json,ts,md}\" \"docs/**/*.md\"",
    "format:check": "prettier --check \"{src,web,test,scripts}/**/*.{ts,vue,less,cjs}\" \"*.{json,ts,md}\" \"docs/**/*.md\""
  },
  "dependencies": {
    "@css-render/vue3-ssr": "0.15.14",
    "@nestjs/common": "11.2.3",
    "@nestjs/config": "4.0.4",
    "@nestjs/core": "11.2.3",
    "@nestjs/platform-express": "11.2.3",
    "@vue/server-renderer": "3.5.41",
    "@wlisfes/chat-web-base-schema": "1.4.6",
    "date-fns": "4.4.0",
    "express": "5.2.1",
    "js-yaml": "4.1.0",
    "nacos": "2.6.3",
    "naive-ui": "2.45.2",
    "pinia": "2.3.1",
    "reflect-metadata": "0.2.2",
    "rxjs": "7.8.2",
    "ssr-common-utils": "6.2.162",
    "ssr-core": "6.2.30",
    "ssr-hoc-vue3": "6.2.2",
    "vue": "3.5.41",
    "vue-router": "4.6.4",
    "vueuc": "0.4.66"
  },
  "devDependencies": {
    "@nestjs/cli": "11.0.24",
    "@nestjs/testing": "11.2.3",
    "@playwright/test": "1.62.1",
    "@swc/cli": "0.1.62",
    "@swc/core": "1.3.72",
    "@types/express": "5.0.6",
    "@types/node": "24.13.3",
    "@types/semver": "7.8.0",
    "@types/shelljs": "0.8.17",
    "@types/supertest": "7.2.1",
    "@vue/compiler-sfc": "3.5.41",
    "cross-env": "10.1.0",
    "less": "4.9.0",
    "prettier": "3.9.6",
    "ssr": "6.2.83",
    "ssr-plugin-nestjs": "6.2.26",
    "ssr-plugin-vue3": "6.2.125",
    "ssr-types": "6.2.66",
    "ssr-webpack": "6.2.17",
    "supertest": "7.2.2",
    "tsx": "4.23.12",
    "typescript": "5.7.3",
    "vue-tsc": "3.3.11",
    "webpack": "4.47.0"
  }
}
```

Create `.npmrc` without credentials:

```ini
@wlisfes:registry=https://npm.pkg.github.com
always-auth=true
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
build/
coverage/
playwright-report/
test-results/
.env
.env.local
*.log
.DS_Store
```

Create `.prettierrc`:

```json
{
  "printWidth": 140,
  "useTabs": false,
  "semi": false,
  "tabWidth": 4,
  "singleQuote": true,
  "trailingComma": "none",
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

Create `tsconfig.json`:

```json
{
  "compileOnSave": true,
  "compilerOptions": {
    "baseUrl": ".",
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "sourceMap": true,
    "declaration": true,
    "jsx": "preserve",
    "outDir": "dist",
    "paths": {
      "~/*": ["./*"],
      "@/*": ["./web/*"],
      "~src/*": ["./src/*"],
      "_build/*": ["./build/*"]
    },
    "types": ["node"]
  },
  "include": ["config.ts", "src/**/*.ts", "web/**/*.ts", "web/**/*.vue", "web/**/*.d.ts", "test/**/*.ts", "playwright.config.ts"],
  "exclude": ["node_modules", "dist", "build"]
}
```

Create `tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "test", "dist", "build", "**/*.spec.ts"]
}
```

- [ ] **Step 3: Preserve the workspace rules inside the standalone repository**

Create `AGENTS.md`:

```markdown
# Chat Web Skyline Service instructions

## 默认双机部署规则

- `E:\chat-web-service` 下所有需要 Docker 自动部署的新旧服务，默认同时部署到 Company 和 Home 两台独立机器。Company Runner 标签固定为 `chat-server-company`，Home Runner 标签固定为 `chat-server-home`。只有用户明确批准单机例外时，才允许移除其中一台。
- GitHub Actions 必须只构建并发布一次镜像，并将同一个完整 Git SHA 镜像部署到两台机器；禁止两台机器各自构建可能不同的 `latest` 版本。
- 部署阶段使用矩阵，包含 `company / chat-server-company / production-company` 和 `home / chat-server-home / production-home`。矩阵必须设置 `fail-fast: false`，并使用按机器隔离的 `deploy-${server}` concurrency，使某台机器离线、排队或失败时不影响另一台。
- 每个服务仓库在两台机器上分别安装该仓库专用的 Self-hosted Runner。每个服务使用独立部署目录 `/opt/<repository-name>`；不得让不同服务覆盖同一个部署目录。
- 服务默认加入外部 Docker 网络 `chat-web-infrastructure`，Compose 项目名使用 `chat-web-service`。新增服务不得自动重建、删除或接管已经存在的 MySQL、Redis、RabbitMQ、Nacos 等基础设施容器。
- 两台机器的部署都必须有容器健康检查、部署后端点验证和失败自动回滚。机器离线时任务应保留等待，Runner 恢复后继续部署对应的精确 SHA。

## 部署记录

- 任何影响 Docker、Actions Workflow、Runner、Environment、部署目录、端口、健康检查、回滚、Nacos 或外部网络的改动，都必须同步更新对应仓库的 `deploy/CHANGELOG.md` 和必要的 `deploy/RUNBOOK.md`。
- 变更记录至少包含日期、影响机器、关联版本、变更内容、机器侧操作、验证命令和回滚方法。禁止记录密码、Token、私钥或完整 `.env`。
- 新服务首次接入部署时必须在仓库 `AGENTS.md` 中复制并保留本规则的“双机部署”约束，确保仓库被单独克隆后仍按 Company/Home 双机基线维护。

## 服务数据边界

- 每个业务服务必须使用独立 MySQL 数据库和独立 MySQL 账号。当前 Account 数据库为 `chat_web_account`，Finance 数据库为 `chat_web_finance`；账号只允许访问本服务数据库，不得拥有 `*.*` 全局权限、其他业务库权限或可继承跨库权限的角色。数据库由外部基础设施预创建，业务服务和 Schema 升级器不得执行 `CREATE DATABASE`。
- 每个业务服务必须使用独立 Redis index。Account 固定 index `0`，Finance 固定 index `1`；后续服务接入时必须分配未占用 index。即使使用 `REDIS_URL`，也必须通过显式 `REDIS_DATABASE` 强制本服务 index，禁止读取或修改其他服务的键。
- 业务服务不得导入其他服务的 Entity、连接其他服务数据库、执行跨业务库 SQL，或复用其他服务的 Redis 会话/缓存。跨服务数据访问统一通过带明确请求/响应类型的 HTTP 客户端 Provider（NestJS 中作为 Feign 等价方案）完成。
- Account 是登录会话与身份状态的唯一所有者。其他服务不得持有 Account JWT 密钥或读取 Account Redis 会话；应把 Bearer Token 转发到 Account 内部鉴权接口获取 `AuthPrincipal`。
- 部署和运行手册必须记录本服务数据库名、数据库账号权限校验命令、Redis index、上游服务地址、验证方式与回滚方式，且不得记录真实账号密码。

## Skyline 首版边界

- 首版不得创建 Docker、Compose、GitHub Actions、Runner 或 `deploy/` 文件。
- 首版不连接 MySQL、Redis 或其他有状态基础设施，因此不分配数据库、数据库账号或 Redis index。
- 正常运行采用 Nacos-first；只有测试或明确的离线运行可设置 `NACOS_CONFIG_ENABLED=false` 跳过共享 Nacos 模块。
```

- [ ] **Step 4: Install once and verify the stable v6 dependency line**

Run:

```bash
yarn install
yarn list --pattern "ssr|ssr-types|ssr-plugin-vue3|ssr-plugin-nestjs|ssr-webpack"
yarn list --pattern "css-render|@css-render/vue3-ssr"
```

Expected: install exits 0; the direct SSR packages resolve to `6.2.83`, `6.2.66`, `6.2.125`, `6.2.26`, and `6.2.17`; no stable v7 package is selected; CSS Render resolves compatibly at `0.15.14`.

- [ ] **Step 5: Commit the baseline**

```bash
git add package.json yarn.lock .npmrc .gitignore .prettierrc tsconfig.json tsconfig.build.json AGENTS.md
git commit -m "chore: initialize skyline service baseline"
```

### Task 2: Add deterministic framework and Nacos bootstrap configuration

**Files:**

- Create: `config.ts`
- Create: `.env.example`
- Create: `src/config/nacos-config.ts`
- Test: `test/unit/nacos-config.test.ts`

- [ ] **Step 1: Write the failing strict-switch tests**

Create `test/unit/nacos-config.test.ts`:

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isNacosConfigEnabled } from '../../src/config/nacos-config'

describe('isNacosConfigEnabled', () => {
    it('defaults to enabled', () => {
        assert.equal(isNacosConfigEnabled(undefined), true)
        assert.equal(isNacosConfigEnabled(''), true)
    })

    it('accepts explicit true and false values', () => {
        assert.equal(isNacosConfigEnabled('true'), true)
        assert.equal(isNacosConfigEnabled('false'), false)
    })

    it('rejects ambiguous values', () => {
        assert.throws(() => isNacosConfigEnabled('FALSE'), /NACOS_CONFIG_ENABLED 必须是 true 或 false/)
    })
})
```

- [ ] **Step 2: Run the test and verify that it fails**

Run:

```bash
yarn test:unit
```

Expected: FAIL because `src/config/nacos-config.ts` does not exist.

- [ ] **Step 3: Implement the strict switch and SSR framework config**

Create `src/config/nacos-config.ts`:

```ts
export function isNacosConfigEnabled(value: string | undefined = process.env.NACOS_CONFIG_ENABLED): boolean {
    if (value === undefined || value === '' || value === 'true') return true
    if (value === 'false') return false
    throw new Error('NACOS_CONFIG_ENABLED 必须是 true 或 false')
}
```

Create `config.ts`:

```ts
import type { UserConfig } from 'ssr-types'

const userConfig: UserConfig = {
    serverPort: 4020,
    stream: false,
    whiteList: ['naive-ui', 'vueuc', 'date-fns', '@css-render/vue3-ssr']
}

export { userConfig }
```

Create `.env.example`:

```dotenv
NODE_ENV=development
PORT=4020

NACOS_CONFIG_ENABLED=true
NACOS_SERVER=127.0.0.1:8848
NACOS_NAMESPACE=public
NACOS_GROUP=DEFAULT_GROUP
NACOS_CONFIG_GROUP=DEFAULT_GROUP
NACOS_CONFIG_DATA_ID=chat-web-skyline-service.yaml
NACOS_SERVICE_NAME=chat-web-skyline-service
NACOS_REGISTER_ENABLED=true
NACOS_REGISTER_REQUIRED=false
NACOS_REGISTER_IP=
NACOS_REGISTER_PORT=4020
NACOS_USERNAME=
NACOS_PASSWORD=
```

- [ ] **Step 4: Run the focused test and format check**

Run:

```bash
yarn test:unit
yarn prettier --check config.ts src/config/nacos-config.ts test/unit/nacos-config.test.ts
```

Expected: all three tests PASS and Prettier exits 0.

- [ ] **Step 5: Commit the configuration boundary**

```bash
git add config.ts .env.example src/config/nacos-config.ts test/unit/nacos-config.test.ts
git commit -m "feat: add skyline runtime configuration"
```

### Task 3: Implement Naive UI style extraction as a pure function

**Files:**

- Create: `src/modules/ssr/naive-style-injector.ts`
- Test: `test/unit/naive-style-injector.test.ts`

- [ ] **Step 1: Write failing extraction and validation tests**

Create `test/unit/naive-style-injector.test.ts`:

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { NaiveStyleInjector } from '../../src/modules/ssr/naive-style-injector'

const injector = new NaiveStyleInjector()

describe('NaiveStyleInjector', () => {
    it('moves one collected cssr style into head and removes the placeholder', () => {
        const input = '<html><head><title>x</title></head><body><main>x</main><css-render-style><style cssr-id="button">.n-button{color:red}</style></css-render-style></body></html>'
        const output = injector.inject(input)

        assert.match(output, /<head><title>x<\/title><style cssr-id="button">/)
        assert.doesNotMatch(output, /css-render-style/)
        assert.equal(output.indexOf('<style cssr-id="button">') < output.indexOf('</head>'), true)
    })

    it('collects multiple placeholders and style blocks', () => {
        const input = '<html><head></head><body><css-render-style><style cssr-id="a">a{}</style></css-render-style><css-render-style><style cssr-id="b">b{}</style></css-render-style></body></html>'
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
```

- [ ] **Step 2: Run the focused test and verify that it fails**

Run:

```bash
yarn cross-env NACOS_CONFIG_ENABLED=false tsx --test test/unit/naive-style-injector.test.ts
```

Expected: FAIL because `NaiveStyleInjector` is not defined.

- [ ] **Step 3: Implement exact placeholder extraction and injection**

Create `src/modules/ssr/naive-style-injector.ts`:

```ts
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
```

- [ ] **Step 4: Run all current unit tests**

Run:

```bash
yarn test:unit
```

Expected: Nacos and all five style-injector tests PASS.

- [ ] **Step 5: Commit the style-injection unit**

```bash
git add src/modules/ssr/naive-style-injector.ts test/unit/naive-style-injector.test.ts
git commit -m "feat: inject naive ui SSR styles"
```

### Task 4: Wrap `ssr-core` behind a typed renderer and readiness boundary

**Files:**

- Create: `src/modules/ssr/ssr-runtime.ts`
- Create: `src/modules/ssr/ssr-renderer.service.ts`
- Create: `src/modules/ssr/ssr.module.ts`
- Test: `test/unit/ssr-renderer.service.test.ts`

- [ ] **Step 1: Write failing renderer-mode and readiness tests**

Create `test/unit/ssr-renderer.service.test.ts`:

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { IConfig, ISSRContext } from 'ssr-types'
import { NaiveStyleInjector } from '../../src/modules/ssr/naive-style-injector'
import { SsrRendererService } from '../../src/modules/ssr/ssr-renderer.service'
import type { SsrRenderOptions, SsrRuntime } from '../../src/modules/ssr/ssr-runtime'

function config(isDev: boolean, paths = ['server.js', 'manifest.json', 'chunks.json']): IConfig {
    return {
        isDev,
        dynamicFile: { serverBundle: paths[0], assetManifest: paths[1], asyncChunkMap: paths[2] }
    } as IConfig
}

describe('SsrRendererService', () => {
    it('renders non-streaming SSR and injects collected styles', async () => {
        let options: SsrRenderOptions | undefined
        const runtime: SsrRuntime = {
            render: async (_ctx, nextOptions) => {
                options = nextOptions
                return '<html><head></head><body><div>Skyline</div><css-render-style><style cssr-id="card">.n-card{}</style></css-render-style></body></html>'
            },
            loadConfig: () => config(true)
        }
        const service = new SsrRendererService(runtime, new NaiveStyleInjector())

        const html = await service.renderSsr({} as ISSRContext)

        assert.deepEqual(options, { mode: 'ssr', stream: false })
        assert.match(html, /<head><style cssr-id="card">/)
        assert.doesNotMatch(html, /css-render-style/)
    })

    it('renders CSR once without requiring a style collector', async () => {
        let options: SsrRenderOptions | undefined
        const runtime: SsrRuntime = {
            render: async (_ctx, nextOptions) => {
                options = nextOptions
                return '<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>'
            },
            loadConfig: () => config(true)
        }
        const service = new SsrRendererService(runtime, new NaiveStyleInjector())

        const html = await service.renderCsr({} as ISSRContext)

        assert.deepEqual(options, { mode: 'csr', stream: false })
        assert.match(html, /id="app"/)
    })

    it('is unready before bootstrap and ready in development after bootstrap', () => {
        const runtime: SsrRuntime = { render: async () => '', loadConfig: () => config(true) }
        const service = new SsrRendererService(runtime, new NaiveStyleInjector())

        assert.equal(service.isReady(), false)
        service.markReady()
        assert.equal(service.isReady(), true)
    })

    it('requires all production artifacts after bootstrap', () => {
        const runtime: SsrRuntime = {
            render: async () => '',
            loadConfig: () => config(false, ['Z:/missing/server.js', 'Z:/missing/manifest.json', 'Z:/missing/chunks.json'])
        }
        const service = new SsrRendererService(runtime, new NaiveStyleInjector())

        service.markReady()
        assert.equal(service.isReady(), false)
    })
})
```

- [ ] **Step 2: Run the focused test and verify that it fails**

Run:

```bash
yarn cross-env NACOS_CONFIG_ENABLED=false tsx --test test/unit/ssr-renderer.service.test.ts
```

Expected: FAIL because the renderer service and runtime types do not exist.

- [ ] **Step 3: Add the typed runtime adapter**

Create `src/modules/ssr/ssr-runtime.ts`:

```ts
import type { IConfig, ISSRContext, UserConfig } from 'ssr-types'

export const SSR_RUNTIME = Symbol('SSR_RUNTIME')

export type SsrRenderOptions = UserConfig & {
    mode: 'ssr' | 'csr'
    stream: false
}

export type SsrRenderFunction = (context: ISSRContext, options: SsrRenderOptions) => Promise<string>

export interface SsrRuntime {
    render: SsrRenderFunction
    loadConfig: () => IConfig
}
```

- [ ] **Step 4: Implement rendering and readiness**

Create `src/modules/ssr/ssr-renderer.service.ts`:

```ts
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
```

Create `src/modules/ssr/ssr.module.ts`:

```ts
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
```

- [ ] **Step 5: Run the renderer and complete unit suites**

Run:

```bash
yarn cross-env NACOS_CONFIG_ENABLED=false tsx --test test/unit/ssr-renderer.service.test.ts
yarn test:unit
```

Expected: all renderer tests PASS, then all unit suites PASS.

- [ ] **Step 6: Commit the renderer boundary**

```bash
git add src/modules/ssr test/unit/ssr-renderer.service.test.ts
git commit -m "feat: add typed skyline SSR renderer"
```

### Task 5: Add liveness and SSR readiness endpoints

**Files:**

- Create: `src/modules/health/health.service.ts`
- Create: `src/modules/health/health.controller.ts`
- Create: `src/modules/health/health.module.ts`
- Test: `test/integration/health.controller.test.ts`

- [ ] **Step 1: Write failing HTTP health tests**

Create `test/integration/health.controller.test.ts`:

```ts
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { HealthController } from '../../src/modules/health/health.controller'
import { HealthService } from '../../src/modules/health/health.service'
import { SsrRendererService } from '../../src/modules/ssr/ssr-renderer.service'

describe('health HTTP endpoints', () => {
    let app: INestApplication | undefined

    afterEach(async () => {
        await app?.close()
    })

    async function createApp(ready: boolean): Promise<INestApplication> {
        const moduleRef = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [HealthService, { provide: SsrRendererService, useValue: { isReady: () => ready } }]
        }).compile()
        app = moduleRef.createNestApplication()
        await app.init()
        return app
    }

    it('returns 200 for liveness without checking external services', async () => {
        const testApp = await createApp(false)
        const response = await request(testApp.getHttpServer()).get('/health/live').expect(200)
        assert.equal(response.body.status, 'UP')
    })

    it('returns 200 when the SSR renderer is ready', async () => {
        const testApp = await createApp(true)
        const response = await request(testApp.getHttpServer()).get('/health/ready').expect(200)
        assert.deepEqual(response.body, { status: 'UP', renderer: { ready: true } })
    })

    it('returns 503 when the SSR renderer is not ready', async () => {
        const testApp = await createApp(false)
        const response = await request(testApp.getHttpServer()).get('/health/ready').expect(503)
        assert.deepEqual(response.body, { status: 'DOWN', renderer: { ready: false } })
    })
})
```

- [ ] **Step 2: Run the health test and verify that it fails**

Run:

```bash
yarn cross-env NACOS_CONFIG_ENABLED=false tsx --test test/integration/health.controller.test.ts
```

Expected: FAIL because the health module files do not exist.

- [ ] **Step 3: Implement health state and status codes**

Create `src/modules/health/health.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { SsrRendererService } from '../ssr/ssr-renderer.service'

@Injectable()
export class HealthService {
    constructor(private readonly renderer: SsrRendererService) {}

    getLiveness(): { status: 'UP' } {
        return { status: 'UP' }
    }

    getReadiness(): { status: 'UP' | 'DOWN'; renderer: { ready: boolean } } {
        const ready = this.renderer.isReady()
        return { status: ready ? 'UP' : 'DOWN', renderer: { ready } }
    }
}
```

Create `src/modules/health/health.controller.ts`:

```ts
import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import type { Response } from 'express'
import { HealthService } from './health.service'

@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

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
```

Create `src/modules/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

@Module({
    controllers: [HealthController],
    providers: [HealthService]
})
export class HealthModule {}
```

- [ ] **Step 4: Run the health integration test**

Run:

```bash
yarn cross-env NACOS_CONFIG_ENABLED=false tsx --test test/integration/health.controller.test.ts
```

Expected: all three HTTP tests PASS.

- [ ] **Step 5: Commit health endpoints**

```bash
git add src/modules/health test/integration/health.controller.test.ts
git commit -m "feat: add skyline health endpoints"
```

### Task 6: Add the root page controller, one-shot fallback, and Nest bootstrap

**Files:**

- Create: `src/modules/skyline/skyline.controller.ts`
- Create: `src/modules/skyline/skyline.module.ts`
- Create: `src/app.module.ts`
- Create: `src/main.ts`
- Test: `test/integration/skyline.controller.test.ts`

- [ ] **Step 1: Write failing HTTP fallback tests**

Create `test/integration/skyline.controller.test.ts`:

```ts
import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { SkylineController } from '../../src/modules/skyline/skyline.controller'
import { SsrRendererService } from '../../src/modules/ssr/ssr-renderer.service'

describe('SkylineController', () => {
    let app: INestApplication | undefined

    afterEach(async () => {
        await app?.close()
    })

    async function createApp(renderer: Pick<SsrRendererService, 'renderSsr' | 'renderCsr'>) {
        const moduleRef = await Test.createTestingModule({
            controllers: [SkylineController],
            providers: [{ provide: SsrRendererService, useValue: renderer }]
        }).compile()
        app = moduleRef.createNestApplication()
        await app.init()
        return app
    }

    it('returns an SSR response and mode header', async () => {
        const renderer = {
            renderSsr: mock.fn(async () => '<!DOCTYPE html><html><body>SSR Skyline</body></html>'),
            renderCsr: mock.fn(async () => '')
        }
        const testApp = await createApp(renderer)

        const response = await request(testApp.getHttpServer()).get('/').expect(200)

        assert.equal(response.headers['x-render-mode'], 'ssr')
        assert.match(response.text, /SSR Skyline/)
        assert.equal(renderer.renderSsr.mock.callCount(), 1)
        assert.equal(renderer.renderCsr.mock.callCount(), 0)
    })

    it('falls back to CSR exactly once after an SSR error', async () => {
        const renderer = {
            renderSsr: mock.fn(async () => {
                throw new Error('ssr failed')
            }),
            renderCsr: mock.fn(async () => '<!DOCTYPE html><html><body><div id="app"></div></body></html>')
        }
        const testApp = await createApp(renderer)

        const response = await request(testApp.getHttpServer()).get('/').expect(200)

        assert.equal(response.headers['x-render-mode'], 'csr')
        assert.match(response.text, /id="app"/)
        assert.equal(renderer.renderSsr.mock.callCount(), 1)
        assert.equal(renderer.renderCsr.mock.callCount(), 1)
    })

    it('returns a generic 500 when SSR and CSR both fail', async () => {
        const renderer = {
            renderSsr: mock.fn(async () => {
                throw new Error('internal-ssr-stack')
            }),
            renderCsr: mock.fn(async () => {
                throw new Error('internal-csr-stack')
            })
        }
        const testApp = await createApp(renderer)

        const response = await request(testApp.getHttpServer()).get('/').expect(500)

        assert.match(response.text, /页面暂时无法加载/)
        assert.doesNotMatch(response.text, /internal-ssr-stack|internal-csr-stack/)
        assert.equal(renderer.renderSsr.mock.callCount(), 1)
        assert.equal(renderer.renderCsr.mock.callCount(), 1)
    })
})
```

- [ ] **Step 2: Run the Skyline test and verify that it fails**

Run:

```bash
yarn cross-env NACOS_CONFIG_ENABLED=false tsx --test test/integration/skyline.controller.test.ts
```

Expected: FAIL because `SkylineController` does not exist.

- [ ] **Step 3: Implement the controller and module**

Create `src/modules/skyline/skyline.controller.ts`:

```ts
import { Controller, Get, HttpStatus, Logger, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { ISSRNestContext } from 'ssr-types'
import { SsrRendererService } from '../ssr/ssr-renderer.service'

const ERROR_PAGE = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>Skyline</title></head><body><main><h1>页面暂时无法加载</h1><p>请稍后重试。</p></main></body></html>'

@Controller()
export class SkylineController {
    private readonly logger = new Logger(SkylineController.name)

    constructor(private readonly renderer: SsrRendererService) {}

    @Get('/')
    async renderIndex(@Req() request: Request, @Res() response: Response): Promise<void> {
        const context: ISSRNestContext = { request, response }
        try {
            const html = await this.renderer.renderSsr(context)
            this.sendHtml(response, HttpStatus.OK, 'ssr', html)
        } catch (error) {
            this.logger.error({ message: 'Skyline SSR 渲染失败，准备降级 CSR', path: request.path, error: this.errorMessage(error) })
            try {
                const html = await this.renderer.renderCsr(context)
                this.sendHtml(response, HttpStatus.OK, 'csr', html)
            } catch (fallbackError) {
                this.logger.error({ message: 'Skyline CSR 降级失败', path: request.path, error: this.errorMessage(fallbackError) })
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
```

Create `src/modules/skyline/skyline.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { SkylineController } from './skyline.controller'

@Module({ controllers: [SkylineController] })
export class SkylineModule {}
```

- [ ] **Step 4: Compose the app with default-on shared Nacos**

Create `src/app.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { isNacosConfigEnabled } from './config/nacos-config'
import { HealthModule } from './modules/health/health.module'
import { SkylineModule } from './modules/skyline/skyline.module'
import { SsrModule } from './modules/ssr/ssr.module'

const configModule = ConfigModule.forRoot({ isGlobal: true })
const nacosImports = isNacosConfigEnabled()
    ? [NacosModule.forRoot({ serviceName: 'chat-web-skyline-service', defaultPort: 4020 })]
    : []

@Module({
    imports: [configModule, ...nacosImports, SsrModule, HealthModule, SkylineModule]
})
export class AppModule {}
```

Create `src/main.ts`:

```ts
import 'reflect-metadata'
import { join } from 'node:path'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { createRequestLoggingMiddleware, createStructuredLogger } from '@wlisfes/chat-web-base-schema/logging'
import { requestContextMiddleware } from '@wlisfes/chat-web-base-schema/request-context'
import { getCwd, initialSSRDevProxy, loadConfig } from 'ssr-common-utils'
import { AppModule } from './app.module'
import { SsrRendererService } from './modules/ssr/ssr-renderer.service'

const SERVICE_NAME = 'chat-web-skyline-service'
const logger = createStructuredLogger({ serviceName: SERVICE_NAME })

function resolvePort(value: unknown): number {
    const port = Number(value)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('服务端口必须是 1-65535 之间的整数')
    return port
}

export async function bootstrap(): Promise<NestExpressApplication> {
    if (process.env.PORT && !process.env.NACOS_REGISTER_PORT) process.env.NACOS_REGISTER_PORT = process.env.PORT

    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger })
    app.enableShutdownHooks()
    app.use(requestContextMiddleware)
    app.use(createRequestLoggingMiddleware({ serviceName: SERVICE_NAME }))

    await initialSSRDevProxy(app, { express: true })
    app.useStaticAssets(join(getCwd(), 'build'))
    app.useStaticAssets(join(getCwd(), 'build/client'))
    app.useStaticAssets(join(getCwd(), 'public'))

    const configService = app.get(ConfigService)
    const port = resolvePort(process.env.PORT ?? configService.get('server.port') ?? loadConfig().serverPort)
    app.get(SsrRendererService).markReady()
    await app.listen(port, '0.0.0.0')
    logger.log({ message: `Chat Web Skyline 服务启动：http://127.0.0.1:${port}`, port })
    return app
}

if (require.main === module) {
    void bootstrap().catch(error => {
        logger.error(error, 'Bootstrap')
        process.exitCode = 1
    })
}
```

- [ ] **Step 5: Run HTTP tests and TypeScript server checking**

Run:

```bash
yarn cross-env NACOS_CONFIG_ENABLED=false tsx --test --test-concurrency=1 test/integration/*.test.ts
yarn tsc -p tsconfig.build.json --noEmit
```

Expected: six HTTP integration tests PASS and server TypeScript exits 0 without contacting Nacos.

- [ ] **Step 6: Commit the Nest application shell**

```bash
git add src/app.module.ts src/main.ts src/modules/skyline test/integration/skyline.controller.test.ts
git commit -m "feat: add skyline HTTP rendering fallback"
```

### Task 7: Build the Vue3, Pinia, and Naive UI SSR page

**Files:**

- Create: `web/components/layout/index.vue`
- Create: `web/components/layout/App.vue`
- Create: `web/pages/index/render.vue`
- Create: `web/pages/index/fetch.ts`
- Create: `web/store/index.ts`
- Create: `web/common.less`
- Create: `web/@types/global.d.ts`

- [ ] **Step 1: Add the SSR document and per-request CSS collector**

Create `web/components/layout/index.vue`:

```vue
<template>
    <html lang="zh-CN">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta name="theme-color" content="#0f172a" />
            <meta name="description" content="Chat Web Skyline 服务端渲染技术验证页" />
            <title>Chat Web Skyline</title>
            <slot name="injectHeader" />
        </head>
        <body>
            <slot name="content" />
        </body>
    </html>
</template>
```

Create `web/components/layout/App.vue`:

```vue
<template>
    <router-view :async-data="asyncData" />
    <css-render-style v-if="!__isBrowser__" v-html="collect()" />
</template>

<script lang="ts" setup>
import { setup as setupCssRender } from '@css-render/vue3-ssr'
import type { App } from 'vue'

const props = defineProps<{
    ssrApp: App
    asyncData: { value: unknown }
}>()

const { collect } = setupCssRender(props.ssrApp)
</script>

<style lang="less">
@import '@/common.less';
</style>
```

- [ ] **Step 2: Add the deterministic Pinia counter and page fetch contract**

Create `web/store/index.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSkylineStore = defineStore('skyline', () => {
    const count = ref(0)
    const increment = (): void => {
        count.value += 1
    }
    return { count, increment }
})
```

Create `web/pages/index/fetch.ts`:

```ts
export default async function fetchSkylinePage(): Promise<void> {
    await Promise.resolve()
}
```

- [ ] **Step 3: Add the Naive UI validation page**

Create `web/pages/index/render.vue`:

```vue
<template>
    <n-config-provider>
        <main class="skyline-page">
            <section class="skyline-hero">
                <p class="skyline-eyebrow">CHAT WEB / SKYLINE</p>
                <h1>服务端渲染基础框架已就绪</h1>
                <p class="skyline-summary">NestJS + Vue3 + Naive UI SSR</p>
                <n-space align="center">
                    <n-tag type="success" :bordered="false">服务运行中</n-tag>
                    <n-tag type="info" :bordered="false" data-testid="render-mode">{{ renderMode }}</n-tag>
                </n-space>
            </section>

            <n-grid cols="1 m:2" responsive="screen" :x-gap="20" :y-gap="20">
                <n-grid-item>
                    <n-card title="服务端首屏" embedded>
                        <n-alert type="success" :show-icon="true">
                            当前 HTML 已包含 Vue 页面内容、Naive UI 标记和 cssr-id 样式。
                        </n-alert>
                    </n-card>
                </n-grid-item>
                <n-grid-item>
                    <n-card title="Hydration 验证" embedded>
                        <p>点击按钮验证客户端已接管服务端生成的页面。</p>
                        <n-button type="primary" data-testid="hydration-counter" @click="increment">
                            Hydration 计数：{{ count }}
                        </n-button>
                    </n-card>
                </n-grid-item>
            </n-grid>
        </main>
    </n-config-provider>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { NAlert, NButton, NCard, NConfigProvider, NGrid, NGridItem, NSpace, NTag } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useSkylineStore } from '@/store'

const store = useSkylineStore()
const { count } = storeToRefs(store)
const { increment } = store
const renderMode = computed(() => (__isBrowser__ && window.__USE_SSR__ === false ? 'CSR' : 'SSR'))
</script>
```

Create `web/common.less`:

```less
:root {
    color: #e2e8f0;
    background: #020617;
    font-family:
        Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
    box-sizing: border-box;
}

body {
    min-width: 320px;
    min-height: 100vh;
    margin: 0;
    background:
        radial-gradient(circle at 15% 10%, rgba(14, 165, 233, 0.22), transparent 34rem),
        linear-gradient(145deg, #020617 0%, #0f172a 52%, #111827 100%);
}

.skyline-page {
    width: min(1080px, calc(100% - 40px));
    margin: 0 auto;
    padding: 72px 0;
}

.skyline-hero {
    margin-bottom: 36px;
}

.skyline-eyebrow {
    margin: 0 0 12px;
    color: #38bdf8;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.18em;
}

.skyline-hero h1 {
    max-width: 760px;
    margin: 0;
    color: #f8fafc;
    font-size: clamp(38px, 7vw, 72px);
    line-height: 1.02;
}

.skyline-summary {
    margin: 20px 0;
    color: #94a3b8;
    font-size: 18px;
}

@media (max-width: 640px) {
    .skyline-page {
        width: min(100% - 24px, 1080px);
        padding: 40px 0;
    }
}
```

Create `web/@types/global.d.ts`:

```ts
import type { IWindow } from 'ssr-types'

declare global {
    interface Window extends IWindow {}
    const __isBrowser__: boolean
}

declare module '*.less'
declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
    export default component
}

export {}
```

- [ ] **Step 4: Type-check both server and Vue code**

Run:

```bash
yarn typecheck
```

Expected: both `tsc` and `vue-tsc` exit 0.

- [ ] **Step 5: Run the raw framework build once**

Run:

```bash
yarn ssr build
```

Expected: Webpack client, Webpack server, and NestJS builds complete; `dist/main.js`, `build/server/Page.server.js`, `build/client/asset-manifest.json`, and `build/asyncChunkMap.json` exist.

- [ ] **Step 6: Commit the Vue SSR page**

```bash
git add web
git commit -m "feat: add naive ui skyline SSR page"
```

### Task 8: Reject false-positive builds and verify real production HTTP

**Files:**

- Create: `scripts/verify-build.cjs`
- Create: `test/unit/verify-build.test.cjs`
- Create: `test/integration/production-http.test.cjs`

- [ ] **Step 1: Write failing build-verifier tests**

Create `test/unit/verify-build.test.cjs`:

```js
const assert = require('node:assert/strict')
const { mkdirSync, mkdtempSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { describe, it } = require('node:test')
const { verifyBuild } = require('../../scripts/verify-build.cjs')

function createRoot() {
    return mkdtempSync(join(tmpdir(), 'skyline-build-'))
}

describe('verifyBuild', () => {
    it('rejects a build missing required artifacts', () => {
        assert.throws(() => verifyBuild(createRoot()), /缺少构建产物/)
    })

    it('accepts complete artifacts with a JavaScript client entry', () => {
        const root = createRoot()
        mkdirSync(join(root, 'dist'), { recursive: true })
        mkdirSync(join(root, 'build/server'), { recursive: true })
        mkdirSync(join(root, 'build/client'), { recursive: true })
        writeFileSync(join(root, 'dist/main.js'), '')
        writeFileSync(join(root, 'build/server/Page.server.js'), '')
        writeFileSync(join(root, 'build/asyncChunkMap.json'), '{}')
        writeFileSync(join(root, 'build/client/asset-manifest.json'), JSON.stringify({ 'Page.js': '/static/Page.abc.js' }))

        assert.doesNotThrow(() => verifyBuild(root))
    })

    it('rejects a manifest without a client JavaScript asset', () => {
        const root = createRoot()
        mkdirSync(join(root, 'dist'), { recursive: true })
        mkdirSync(join(root, 'build/server'), { recursive: true })
        mkdirSync(join(root, 'build/client'), { recursive: true })
        writeFileSync(join(root, 'dist/main.js'), '')
        writeFileSync(join(root, 'build/server/Page.server.js'), '')
        writeFileSync(join(root, 'build/asyncChunkMap.json'), '{}')
        writeFileSync(join(root, 'build/client/asset-manifest.json'), JSON.stringify({ 'Page.css': '/static/Page.css' }))

        assert.throws(() => verifyBuild(root), /client JavaScript/)
    })
})
```

- [ ] **Step 2: Run the verifier test and verify that it fails**

Run:

```bash
node --test test/unit/verify-build.test.cjs
```

Expected: FAIL because `scripts/verify-build.cjs` does not exist.

- [ ] **Step 3: Implement the artifact verifier**

Create `scripts/verify-build.cjs`:

```js
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const requiredArtifacts = [
    'dist/main.js',
    'build/server/Page.server.js',
    'build/client/asset-manifest.json',
    'build/asyncChunkMap.json'
]

function collectStrings(value) {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.flatMap(collectStrings)
    if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings)
    return []
}

function verifyBuild(root = process.cwd()) {
    const missing = requiredArtifacts.filter(relativePath => !existsSync(join(root, relativePath)))
    if (missing.length > 0) throw new Error(`缺少构建产物：${missing.join(', ')}`)

    const manifestPath = join(root, 'build/client/asset-manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (!collectStrings(manifest).some(value => /\.js(?:\?|$)/.test(value))) {
        throw new Error('asset-manifest.json 不包含 client JavaScript 资源')
    }
}

if (require.main === module) {
    try {
        verifyBuild()
        console.log('Skyline build artifacts verified')
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    }
}

module.exports = { verifyBuild }
```

- [ ] **Step 4: Make build and test commands enforce artifact verification**

Update only the `scripts` object in `package.json` to:

```json
{
  "start": "ssr start",
  "dev": "ssr start",
  "build": "ssr build && node scripts/verify-build.cjs",
  "start:prod": "cross-env NODE_ENV=production node dist/main.js",
  "typecheck": "tsc -p tsconfig.build.json --noEmit && vue-tsc -p tsconfig.json --noEmit",
  "test:unit": "cross-env NACOS_CONFIG_ENABLED=false tsx --test test/unit/*.test.ts && node --test test/unit/*.test.cjs",
  "test:integration": "yarn build && cross-env NACOS_CONFIG_ENABLED=false tsx --test --test-concurrency=1 test/integration/*.test.ts && node --test test/integration/*.test.cjs",
  "test": "yarn format:check && yarn typecheck && yarn test:unit && yarn test:integration",
  "test:e2e": "yarn build && playwright test",
  "format": "prettier --write \"{src,web,test,scripts}/**/*.{ts,vue,less,cjs}\" \"*.{json,ts,md}\" \"docs/**/*.md\"",
  "format:check": "prettier --check \"{src,web,test,scripts}/**/*.{ts,vue,less,cjs}\" \"*.{json,ts,md}\" \"docs/**/*.md\""
}
```

- [ ] **Step 5: Write the real production-artifact HTTP test**

Create `test/integration/production-http.test.cjs`:

```js
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const net = require('node:net')
const { after, before, describe, it } = require('node:test')

async function freePort() {
    return await new Promise((resolve, reject) => {
        const server = net.createServer()
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            const port = typeof address === 'object' && address ? address.port : 0
            server.close(error => (error ? reject(error) : resolve(port)))
        })
    })
}

async function waitFor(url, child, output) {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`Skyline 提前退出：${output()}`)
        try {
            const response = await fetch(url)
            if (response.ok) return
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 200))
    }
    throw new Error(`等待 Skyline 启动超时：${output()}`)
}

describe('production Skyline HTTP', () => {
    let child
    let baseUrl
    let logs = ''

    before(async () => {
        const port = await freePort()
        baseUrl = `http://127.0.0.1:${port}`
        child = spawn(process.execPath, ['dist/main.js'], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                NODE_ENV: 'production',
                PORT: String(port),
                NACOS_CONFIG_ENABLED: 'false',
                NACOS_REGISTER_ENABLED: 'false'
            },
            stdio: ['ignore', 'pipe', 'pipe']
        })
        child.stdout.on('data', chunk => {
            logs += chunk.toString()
        })
        child.stderr.on('data', chunk => {
            logs += chunk.toString()
        })
        await waitFor(`${baseUrl}/health/live`, child, () => logs)
    })

    after(async () => {
        if (child && child.exitCode === null) {
            child.kill()
            await once(child, 'exit')
        }
    })

    it('reports production SSR readiness', async () => {
        const response = await fetch(`${baseUrl}/health/ready`)
        assert.equal(response.status, 200)
        assert.deepEqual(await response.json(), { status: 'UP', renderer: { ready: true } })
    })

    it('serves a styled SSR page and client bundle', async () => {
        const response = await fetch(`${baseUrl}/`)
        const html = await response.text()

        assert.equal(response.status, 200)
        assert.equal(response.headers.get('x-render-mode'), 'ssr')
        assert.match(html, /服务端渲染基础框架已就绪/)
        assert.match(html, /Hydration 计数：(?:<!--.*?-->)?0/)
        assert.match(html, /class="[^"]*n-(?:card|button)/)
        assert.match(html, /<style cssr-id=/)
        assert.match(html, /<script[^>]+src=/)
        assert.doesNotMatch(html, /css-render-style/)
    })
})
```

- [ ] **Step 6: Run build verifier and production HTTP tests**

Run:

```bash
node --test test/unit/verify-build.test.cjs
yarn test:integration
```

Expected: three verifier tests PASS; the build prints `Skyline build artifacts verified`; all module HTTP tests and both real production HTTP tests PASS.

- [ ] **Step 7: Commit production verification**

```bash
git add package.json scripts/verify-build.cjs test/unit/verify-build.test.cjs test/integration/production-http.test.cjs
git commit -m "test: verify skyline production SSR build"
```

### Task 9: Verify browser Hydration and document operation boundaries

**Files:**

- Create: `playwright.config.ts`
- Create: `test/e2e/home.spec.ts`
- Create: `README.md`

- [ ] **Step 1: Add the production Playwright server configuration**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './test/e2e',
    fullyParallel: false,
    retries: 0,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4020',
        trace: 'retain-on-failure'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'yarn start:prod',
        url: 'http://127.0.0.1:4020/health/ready',
        reuseExistingServer: false,
        timeout: 30000,
        env: {
            PORT: '4020',
            NACOS_CONFIG_ENABLED: 'false',
            NACOS_REGISTER_ENABLED: 'false'
        }
    }
})
```

- [ ] **Step 2: Write the browser Hydration test**

Create `test/e2e/home.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('hydrates the server-rendered Naive UI page without console errors', async ({ page }) => {
    const consoleProblems: string[] = []
    page.on('console', message => {
        if (message.type() === 'warning' || message.type() === 'error') consoleProblems.push(message.text())
    })
    page.on('pageerror', error => consoleProblems.push(error.message))

    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    expect(response?.headers()['x-render-mode']).toBe('ssr')
    await expect(page.getByRole('heading', { name: '服务端渲染基础框架已就绪' })).toBeVisible()
    await expect(page.locator('head style[cssr-id]')).not.toHaveCount(0)
    await expect(page.locator('css-render-style')).toHaveCount(0)

    const counter = page.getByTestId('hydration-counter')
    await expect(counter).toContainText('Hydration 计数：0')
    await counter.click()
    await expect(counter).toContainText('Hydration 计数：1')
    expect(consoleProblems).toEqual([])
})
```

- [ ] **Step 3: Verify E2E formatting**

Run:

```bash
yarn prettier --check playwright.config.ts test/e2e/home.spec.ts
```

Expected: Prettier exits 0; the existing root `*.ts` and `test/**/*` globs already cover both files.

- [ ] **Step 4: Write the operating and boundary documentation**

Create `README.md`:

```markdown
# chat-web-skyline-service

NestJS 11 + Vue3 + Naive UI 的单进程服务端渲染基础服务。当前版本使用可从 npm 独立安装的 `ssr` 6.2 稳定版本线与 Webpack 4；待 v7 的 Vue3 插件和类型包完整发布后再单独评估升级。

## 环境

- Node.js 20 或更高版本
- Yarn 1.22.x
- 能读取 `@wlisfes` GitHub Packages 的本机 npm 凭据；仓库 `.npmrc` 只记录 registry，不记录 Token

## 安装与运行

```bash
yarn install --frozen-lockfile
yarn dev
```

默认端口为 `4020`。正常运行默认连接 Nacos，并读取 `chat-web-skyline-service.yaml`。显式离线运行：

```bash
NACOS_CONFIG_ENABLED=false NACOS_REGISTER_ENABLED=false yarn dev
```

PowerShell：

```powershell
$env:NACOS_CONFIG_ENABLED='false'
$env:NACOS_REGISTER_ENABLED='false'
yarn dev
```

生产构建与启动：

```bash
yarn build
yarn start:prod
```

`yarn build` 会额外验证 `dist/main.js`、SSR server bundle、client manifest 和 async chunk map，避免 `ssr` CLI 内部失败但退出码仍为 0。

## 验证

```bash
yarn typecheck
yarn test:unit
yarn test:integration
yarn playwright install chromium
yarn test:e2e
yarn test
```

- `GET /health/live` 只验证进程可响应。
- `GET /health/ready` 验证 SSR 运行时已启动，生产环境还验证关键构建产物存在。
- `GET /` 正常返回 `X-Render-Mode: ssr`；SSR 失败时只尝试一次 CSR，并返回 `X-Render-Mode: csr`。

## Nacos 配置

连接 Nacos 所需的最小启动参数见 `.env.example`。业务配置 Data ID 为 `chat-web-skyline-service.yaml`，可包含：

```yaml
server:
  port: 4020
```

生产默认不得关闭 Nacos。`NACOS_CONFIG_ENABLED=false` 只用于测试或明确的离线运行；该开关由 Skyline 在 Nest 模块组合前处理，因为共享 `NacosModule` 初始化后会立即加载配置。

## 数据与身份边界

首版不连接 MySQL 或 Redis，不创建数据库，不分配 Redis index，不导入其他服务 Entity，也不执行跨库 SQL。

Skyline 不保存 Account JWT 密钥，不读取 Account Redis 会话。受保护页面接入时，应从 `@wlisfes/chat-web-base-schema/feign` 使用 `AccountFeignClient`（或共享 `AccountRemoteAuthModule`），将 Bearer Token 转发到 Account 并只接收 `AuthPrincipal`。其他业务数据同样通过强类型 Feign Provider 获取。

## 部署边界

当前仓库没有 Docker、Compose、GitHub Actions、Runner 或 `deploy/` 文件。首次接入自动部署时必须遵守 `AGENTS.md`：同一完整 Git SHA 镜像同时部署 Company 与 Home、独立 Runner 和部署目录、外部 `chat-web-infrastructure` 网络、双机健康验证与失败回滚，并在同一次改动中补全 `deploy/CHANGELOG.md` 和 `deploy/RUNBOOK.md`。
```

- [ ] **Step 5: Install Chromium and run E2E**

Run:

```bash
yarn playwright install chromium
yarn test:e2e
```

Expected: build verification succeeds; Chromium sees `X-Render-Mode: ssr`; at least one `style[cssr-id]` exists in `<head>`; no `css-render-style` remains; no console warning/error occurs; the counter changes from 0 to 1.

- [ ] **Step 6: Commit E2E and documentation**

```bash
git add playwright.config.ts test/e2e/home.spec.ts README.md
git commit -m "test: verify skyline browser hydration"
```

### Task 10: Run final verification and hand off the `developer` branch

**Files:**

- Verify: all tracked project files

- [ ] **Step 1: Format and inspect the change boundary**

Run:

```bash
yarn format
git status --short
git diff --check
rg -n "typeorm|mysql2|RedisModule|RedisService|REDIS_DATABASE|CREATE DATABASE|JwtModule|JWT_SECRET" src web package.json .env.example
rg --files -g "Dockerfile*" -g "docker-compose*" -g ".github/**" -g "deploy/**"
```

Expected: formatting completes; `git diff --check` is silent; the forbidden data/JWT search returns no matches; the Docker/Actions/deploy search returns no files.

- [ ] **Step 2: Run the complete non-browser verification**

Run:

```bash
yarn test
```

Expected: format check, server and Vue type checks, all unit tests, verified production build, controller integration tests, and real production HTTP tests all PASS.

- [ ] **Step 3: Run the browser verification again from the final tree**

Run:

```bash
yarn test:e2e
```

Expected: Chromium Hydration test PASS with no warning or error.

- [ ] **Step 4: Verify dependency and repository state**

Run:

```bash
yarn list --pattern "ssr|ssr-types|ssr-plugin-vue3|ssr-plugin-nestjs|ssr-webpack"
yarn list --pattern "css-render|@css-render/vue3-ssr"
git branch --show-current
git status --short
git log --oneline --decorate -10
```

Expected: only the stable v6 SSR line is selected, CSS Render is compatible at `0.15.14`, current branch is `developer`, and the worktree is clean after the final documentation commit below.

- [ ] **Step 5: Commit final formatting or verification documentation changes**

```bash
git add -A
git commit -m "chore: finalize skyline service foundation"
git status --short
```

Expected: commit succeeds if formatting changed files; if there is nothing to commit, Git reports a clean tree; the final status output is empty. Do not merge into `main` or create a remote PR until the user chooses the integration method.
