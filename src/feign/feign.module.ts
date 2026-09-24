import { Module } from '@nestjs/common'
import { ChunkModule } from '@/modules/chunk/chunk.module'
import { FeignController } from '@/feign/feign.controller'
import { FeignService } from '@/feign/feign.service'

@Module({
    imports: [ChunkModule],
    controllers: [FeignController],
    providers: [FeignService]
})
export class FeignModule {}
