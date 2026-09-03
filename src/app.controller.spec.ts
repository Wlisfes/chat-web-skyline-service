import { Logger } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { AppController } from './app.controller'
import { AppService } from './app.service'

describe('AppController', () => {
    let appController: AppController
    let logger: { log: jest.Mock }

    beforeEach(async () => {
        logger = { log: jest.fn() }
        const app: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [
                AppService,
                {
                    provide: Logger,
                    useValue: logger
                }
            ]
        }).compile()

        appController = app.get<AppController>(AppController)
    })

    describe('root', () => {
        it('should return "Hello World!"', async () => {
            await expect(appController.httpBaseSkylineWelcome()).resolves.toBe('Hello World!')
            expect(logger.log).toHaveBeenCalledWith('正在获取欢迎信息')
        })
    })
})
