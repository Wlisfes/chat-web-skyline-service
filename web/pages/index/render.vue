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
