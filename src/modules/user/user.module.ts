import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PasswordService } from '@wlisfes/chat-web-base-schema/auth'
import { SKYLINE_MYSQL_ENTITIES } from '@/database/database.constants'
import { ChunkModule } from '@/modules/chunk/chunk.module'
import { UserController } from '@/modules/user/user.controller'
import { UserUtilsService } from '@/modules/user/user.utils.service'
import { UserService } from '@/modules/user/user.service'

@Module({
    imports: [TypeOrmModule.forFeature(SKYLINE_MYSQL_ENTITIES), ChunkModule],
    controllers: [UserController],
    providers: [UserService, UserUtilsService, PasswordService],
    exports: [UserService]
})
export class UserModule {}
