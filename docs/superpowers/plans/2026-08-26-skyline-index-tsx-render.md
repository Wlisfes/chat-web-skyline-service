# Skyline Index TSX Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Skyline 首页从 Vue 模板语法等价重构为 `defineComponent` 与 TSX 渲染函数，同时保持 SSR、水合、样式和交互行为不变。

**Architecture:** 保留 `render.vue` 及 SSR 框架的页面发现约定，只替换组件内部的表达方式。Pinia 状态和计算属性继续在 `setup` 中创建，由返回的 TSX 函数读取 ref 值并渲染现有 Naive UI 组件树。

**Tech Stack:** Vue 3.5、TypeScript、TSX、Pinia、Naive UI、NestJS SSR、Playwright

---

## 文件结构

- Modify: `web/pages/index/render.vue` — Skyline 首页组件及其 TSX 渲染函数。
- Test: `test/e2e/home.spec.ts` — 现有首页 SSR、水合、样式注入、点击交互和控制台回归测试，不修改测试内容。

### Task 1: 建立等价重构基线

**Files:**

- Test: `test/e2e/home.spec.ts`

- [ ] **Step 1: 执行当前类型检查**

Run:

```powershell
yarn typecheck
```

Expected: `tsc` 和 `vue-tsc` 均以退出码 `0` 完成。

- [ ] **Step 2: 执行当前首页生产态回归测试**

先在运行 `yarn dev` 的终端按 `Ctrl+C` 释放 `4020` 端口，然后运行：

```powershell
yarn test:e2e
```

Expected: 构建产物校验成功，`home.spec.ts` 显示 `1 passed`，浏览器控制台问题数组为空。

- [ ] **Step 3: 恢复本地开发服务**

Run:

```powershell
yarn dev
```

Expected: NestJS 监听 `4020`，Webpack HMR 监听 `8999`。

### Task 2: 将首页改为 defineComponent TSX

**Files:**

- Modify: `web/pages/index/render.vue`

- [ ] **Step 1: 用 TSX 组件替换模板和 script setup**

将 `web/pages/index/render.vue` 完整替换为：

```vue
<script lang="tsx">
import { computed, defineComponent } from 'vue'
import { NAlert, NButton, NCard, NConfigProvider, NGrid, NGridItem, NSpace, NTag } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useSkylineStore } from '@/store'

export default defineComponent({
    name: 'SkylineIndex',
    setup() {
        const store = useSkylineStore()
        const { count } = storeToRefs(store)
        const { increment } = store
        const renderMode = computed(() => (__isBrowser__ && window.__USE_SSR__ === false ? 'CSR' : 'SSR'))

        return () => (
            <NConfigProvider>
                <main class="skyline-page">
                    <section class="skyline-hero">
                        <p class="skyline-eyebrow">CHAT WEB / SKYLINE</p>
                        <h1>服务端渲染基础框架已就绪</h1>
                        <p class="skyline-summary">NestJS + Vue3 + Naive UI SSR</p>
                        <NSpace align="center">
                            <NTag type="success" bordered={false}>
                                服务运行中
                            </NTag>
                            <NTag type="info" bordered={false} data-testid="render-mode">
                                {renderMode.value}
                            </NTag>
                        </NSpace>
                    </section>

                    <NGrid cols="1 m:2" responsive="self" xGap={20} yGap={20}>
                        <NGridItem>
                            <NCard title="服务端首屏" embedded={true}>
                                <NAlert type="success" showIcon={true}>
                                    当前 HTML 已包含 Vue 页面内容、Naive UI 标记和 cssr-id 样式。
                                </NAlert>
                            </NCard>
                        </NGridItem>
                        <NGridItem>
                            <NCard title="Hydration 验证" embedded={true}>
                                <p>点击按钮验证客户端已接管服务端生成的页面。</p>
                                <NButton type="primary" data-testid="hydration-counter" onClick={increment}>
                                    Hydration 计数：{count.value}
                                </NButton>
                            </NCard>
                        </NGridItem>
                    </NGrid>
                </main>
            </NConfigProvider>
        )
    }
})
</script>
```

- [ ] **Step 2: 格式化并检查修改文件**

Run:

```powershell
yarn prettier --write web/pages/index/render.vue
yarn prettier --check web/pages/index/render.vue
git diff --check
```

Expected: Prettier 报告文件符合格式，`git diff --check` 无输出并返回退出码 `0`。

- [ ] **Step 3: 执行 TypeScript 类型检查**

Run:

```powershell
yarn typecheck
```

Expected: `tsc` 和 `vue-tsc` 均以退出码 `0` 完成，TSX 属性和事件类型无错误。

- [ ] **Step 4: 提交 TSX 重构**

Run:

```powershell
git add -- web/pages/index/render.vue
git commit -m "refactor: render skyline index with TSX"
```

Expected: 提交只包含 `web/pages/index/render.vue`。

### Task 3: 验证 SSR、水合和本地开发状态

**Files:**

- Test: `test/e2e/home.spec.ts`

- [ ] **Step 1: 执行生产构建和首页 E2E**

先在运行 `yarn dev` 的终端按 `Ctrl+C` 释放 `4020` 端口，然后运行：

```powershell
yarn test:e2e
```

Expected: 客户端与服务端构建成功，构建产物校验成功，首页用例显示 `1 passed`。用例应继续验证 `X-Render-Mode: ssr`、cssr 样式、Hydration 点击计数以及控制台无 warning/error。

- [ ] **Step 2: 恢复并检查开发服务**

Run:

```powershell
yarn dev
```

另一个终端运行：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4020/health/ready | Select-Object StatusCode
Get-NetTCPConnection -State Listen -LocalPort 4020,8999 | Select-Object LocalAddress,LocalPort,OwningProcess
```

Expected: 健康检查返回 `200`，`4020` 和 `8999` 均处于监听状态。

- [ ] **Step 3: 检查最终工作区**

Run:

```powershell
git status --short
git show --stat --oneline HEAD
```

Expected: 工作区没有未提交变更，最新提交只包含 TSX 页面重构。
