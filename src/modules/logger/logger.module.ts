import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TbSkylineLogger, TbSkylineSheet } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { SkylineLoggerController } from '@/modules/logger/logger.controller'
import { SkylineLoggerService } from '@/modules/logger/logger.service'

@Module({
    imports: [TypeOrmModule.forFeature([TbSkylineLogger, TbSkylineSheet])],
    controllers: [SkylineLoggerController],
    providers: [SkylineLoggerService],
    exports: [SkylineLoggerService]
})
export class SkylineLoggerModule {}
