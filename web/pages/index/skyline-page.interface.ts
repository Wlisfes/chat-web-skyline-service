import type { ApiResponse } from '@wlisfes/chat-web-base-schema'

export interface SkylineMockService {
    name: string
    owner: string
    status: 'online' | 'warning'
    statusName: string
}

export interface SkylinePageFetchData {
    skylineApiResponse: ApiResponse<SkylineMockService[]>
}

export interface SkylinePageAsyncData {
    value: Partial<SkylinePageFetchData>
}
