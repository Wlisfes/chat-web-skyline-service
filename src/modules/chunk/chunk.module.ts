import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TbSkylineChunk } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { ChunkController } from '@/modules/chunk/chunk.controller'
import { ChunkService } from '@/modules/chunk/chunk.service'

/** Skyline 枚举字典模块。 */
@Module({
    imports: [TypeOrmModule.forFeature([TbSkylineChunk])],
    controllers: [ChunkController],
    providers: [ChunkService],
    exports: [ChunkService]
})
export class ChunkModule {}
