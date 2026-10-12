import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { FeignClientSkylineManager, FeignModule } from '@wlisfes/chat-web-base-schema/feign'
import { TbSkylineChunk, TbSkylineChunkModuleEntity } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { ChunkUtilsService } from '@/modules/chunk/chunk.utils.service'
import { ChunkController } from '@/modules/chunk/chunk.controller'
import { ChunkService } from '@/modules/chunk/chunk.service'

/** Skyline 枚举字典模块。 */
@Module({
    imports: [TypeOrmModule.forFeature([TbSkylineChunk, TbSkylineChunkModuleEntity]), FeignModule.register([FeignClientSkylineManager])],
    controllers: [ChunkController],
    providers: [ChunkService, ChunkUtilsService],
    exports: [ChunkService]
})
export class ChunkModule {}
