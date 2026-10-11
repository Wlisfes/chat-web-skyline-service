import { Module } from '@nestjs/common'
import { ChunkModule } from '@/modules/chunk/chunk.module'
import { FeignController } from '@/feign/feign.controller'
import { FeignService } from '@/feign/feign.service'
import { UserModule } from '@/modules/user/user.module'

@Module({
    imports: [ChunkModule, UserModule],
    controllers: [FeignController],
    providers: [FeignService]
})
export class FeignModule {}
