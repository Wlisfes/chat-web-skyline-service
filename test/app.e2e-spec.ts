import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { NACOS_RUNTIME_OPTIONS, NacosService } from '@wlisfes/chat-web-base-schema/nacos'
import request from 'supertest'
import { AppModule } from '../src/app.module'

describe('AppController (e2e)', () => {
    let app: INestApplication

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule]
        })
            .overrideProvider(NACOS_RUNTIME_OPTIONS)
            .useValue({
                serverAddr: '127.0.0.1:8848',
                namespace: 'test',
                registerEnabled: false,
                serviceName: 'chat-web-skyline-service',
                registerPort: 5040
            })
            .overrideProvider(NacosService)
            .useValue({})
            .compile()

        app = moduleFixture.createNestApplication()
        await app.init()
    })

    afterEach(async () => {
        await app.close()
    })

    it('/ (GET)', () => {
        return request(app.getHttpServer()).get('/').expect('Content-Type', 'text/plain; charset=utf-8').expect(200).expect('Hello World!')
    })

    it('/health/live (GET)', () => {
        return request(app.getHttpServer()).get('/health/live').expect(200).expect({ status: 'UP' })
    })
})
