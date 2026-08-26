<script lang="tsx">
import { computed, defineComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { useSkylineStore } from '@web/store'

// N 开头的 Naive UI JSX 组件由构建插件自动注入，无需手动导入
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
                                <n-button type="primary" data-testid="hydration-counter" onClick={increment}>
                                    Hydration 计数：{count.value}
                                </n-button>
                            </NCard>
                        </NGridItem>
                    </NGrid>
                </main>
            </NConfigProvider>
        )
    }
})
</script>
