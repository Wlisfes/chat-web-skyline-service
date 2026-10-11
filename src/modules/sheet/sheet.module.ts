import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SKYLINE_MYSQL_ENTITIES } from '@/database/database.constants'
import { SheetController } from '@/modules/sheet/sheet.controller'
import { SheetUtilsService } from '@/modules/sheet/sheet.utils.service'
import { SheetService } from '@/modules/sheet/sheet.service'

@Module({
    imports: [TypeOrmModule.forFeature(SKYLINE_MYSQL_ENTITIES)],
    controllers: [SheetController],
    providers: [SheetService, SheetUtilsService],
    exports: [SheetService]
})
export class SheetModule {}
