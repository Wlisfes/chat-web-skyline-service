import { Module } from '@nestjs/common'
import { S3Client } from '@aws-sdk/client-s3'
import { GarageController } from '@/modules/garage/garage.controller'
import { PUBLIC_S3, S3 } from '@/modules/garage/garage.constants'
import { configProvider, publicS3Provider, s3Alias, s3Provider } from '@/modules/garage/garage.options'
import { GarageService } from '@/modules/garage/garage.service'
import { GarageUtilsService } from '@/modules/garage/garage.utils.service'

@Module({
    controllers: [GarageController],
    providers: [configProvider, s3Provider, publicS3Provider, s3Alias, GarageService, GarageUtilsService],
    exports: [GarageService, GarageUtilsService, S3Client, S3, PUBLIC_S3]
})
export class GarageModule {}
