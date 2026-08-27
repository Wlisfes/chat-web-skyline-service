import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'

describe('AppController (e2e)', () => {
    let app: INestApplication

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule]
        }).compile()

        app = moduleFixture.createNestApplication()
        await app.init()
    })

    afterEach(async () => {
        await app.close()
    })

    it('/ (GET)', () => {
        return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!')
    })

    it('/health/live (GET)', () => {
        return request(app.getHttpServer()).get('/health/live').expect(200).expect({ status: 'UP' })
    })
})
