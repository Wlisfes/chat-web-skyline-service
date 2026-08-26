import { Module } from '@nestjs/common'
import { SkylineController } from './skyline.controller'

@Module({ controllers: [SkylineController] })
export class SkylineModule {}
