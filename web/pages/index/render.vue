<script lang="tsx">
import { computed, defineComponent, type PropType } from 'vue'
import type { SkylinePageAsyncData, SkylinePageFetchData } from './skyline-page.interface'

export default defineComponent({
    name: 'SkylineIndex',
    inheritAttrs: false,
    props: {
        /** SSR 首屏及客户端路由共享的异步数据容器 */
        asyncData: { type: Object as PropType<SkylinePageAsyncData>, required: true },
        /** 客户端路由切换时重新获取的当前页面数据 */
        fetchData: { type: Object as PropType<Partial<SkylinePageFetchData>>, default: () => ({}) }
    },
    setup(props) {
        const apiResponse = computed(() => props.fetchData.skylineApiResponse ?? props.asyncData.value.skylineApiResponse)
        const services = computed(() => apiResponse.value?.data ?? [])

        console.log('SkylineIndex asyncData', props.asyncData)

        return () => (
            <main class="skyline-page">
                <section class="skyline-hero">
                    <p class="skyline-eyebrow">CHAT WEB / SKYLINE</p>
                    <h1>服务端渲染基础框架已就绪</h1>
                    <p class="skyline-summary">NestJS + Vue3 + Naive UI SSR</p>
                </section>
                <n-button>点击 +1</n-button>
                <n-card class="skyline-api-card" title="模拟接口数据" embedded>
                    {apiResponse.value ? (
                        <n-space vertical size="large">
                            <n-alert type="success" title={apiResponse.value.message} show-icon>
                                GET /mock/skyline/services · 状态码 {apiResponse.value.code}
                            </n-alert>
                            <n-list bordered>
                                {services.value.map(service => (
                                    <n-list-item key={service.name}>
                                        <n-thing title={service.name} description={`归属：${service.owner}`}>
                                            {{
                                                headerExtra: () => (
                                                    <n-tag type={service.status === 'online' ? 'success' : 'warning'} bordered={false}>
                                                        {service.statusName}
                                                    </n-tag>
                                                )
                                            }}
                                        </n-thing>
                                    </n-list-item>
                                ))}
                            </n-list>
                            <n-text depth={3}>响应时间：{apiResponse.value.timestamp}</n-text>
                        </n-space>
                    ) : (
                        <n-skeleton text repeat={3} />
                    )}
                </n-card>
            </main>
        )
    }
})
</script>
