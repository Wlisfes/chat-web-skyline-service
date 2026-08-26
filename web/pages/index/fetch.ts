import type { ApiResponse } from '@wlisfes/chat-web-base-schema'
import type { SkylineMockService, SkylinePageFetchData } from './skyline-page.interface'

const MOCK_REQUEST_DELAY = 80

async function requestSkylineServices(): Promise<ApiResponse<SkylineMockService[]>> {
    await new Promise<void>(resolve => setTimeout(resolve, MOCK_REQUEST_DELAY))

    return {
        code: 200,
        message: '模拟接口请求成功',
        timestamp: new Date().toISOString(),
        data: [
            { name: 'Skyline 首页服务', owner: '前端体验组', status: 'online', statusName: '运行正常' },
            { name: 'SSR 渲染服务', owner: '平台架构组', status: 'online', statusName: '运行正常' },
            { name: '接口聚合服务', owner: '基础服务组', status: 'warning', statusName: '模拟告警' }
        ]
    }
}

export default async function fetchSkylinePage(): Promise<SkylinePageFetchData> {
    return {
        skylineApiResponse: await requestSkylineServices()
    }
}
