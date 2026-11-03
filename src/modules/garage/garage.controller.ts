import { Body, Get, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { GARAGE_MAX_UPLOAD_BYTES, GARAGE_PERMISSION } from '@/modules/garage/garage.constants'
import { RequirePermissions } from '@wlisfes/chat-web-base-schema/auth'
import { GarageService } from '@/modules/garage/garage.service'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiConsumes } from '@nestjs/swagger'
import * as GarageDto from '@/modules/garage/dto/garage.dto'

@ApifoxController('Skyline Garage 对象存储', 'deploy/garage', { bearerAuth: true })
export class GarageController {
    constructor(private readonly garageService: GarageService) {}

    @RequirePermissions(GARAGE_PERMISSION)
    @ApiServiceDecorator(Post('object/column'), {
        operation: { summary: '列出 Garage 对象' },
        request: { source: 'body', type: GarageDto.ListGarageObjectDto },
        response: { type: GarageDto.GarageObjectPageResponseDto, description: 'Garage 对象列表' }
    })
    public async httpBaseSkylineColumnGarageObject(@Body() input: GarageDto.ListGarageObjectDto) {
        return this.garageService.httpBaseSkylineColumnGarageObject(input)
    }

    @RequirePermissions(GARAGE_PERMISSION)
    @ApiServiceDecorator(Get('object/resolve'), {
        operation: { summary: '查询 Garage 对象元数据' },
        request: { source: 'query', type: GarageDto.GarageObjectKeyDto },
        response: { type: GarageDto.GarageObjectResponseDto, description: 'Garage 对象元数据' }
    })
    public async httpBaseSkylineGarageObjectResolver(@Query() query: GarageDto.GarageObjectKeyDto) {
        return this.garageService.httpBaseSkylineGarageObjectResolver(query)
    }

    @RequirePermissions(GARAGE_PERMISSION)
    @ApiServiceDecorator(Post('object/delete'), {
        operation: { summary: '删除 Garage 对象' },
        request: { source: 'body', type: GarageDto.GarageObjectKeyDto },
        response: { type: GarageDto.GarageDeleteResponseDto, description: '删除结果' }
    })
    public async httpBaseSkylineGarageObjectDelete(@Body() input: GarageDto.GarageObjectKeyDto) {
        return this.garageService.httpBaseSkylineGarageObjectDelete(input)
    }

    @RequirePermissions(GARAGE_PERMISSION)
    @ApiServiceDecorator(Post('presign/upload'), {
        operation: { summary: '生成 Garage 上传预签名地址' },
        request: { source: 'body', type: GarageDto.PresignGarageObjectDto },
        response: { type: GarageDto.GaragePresignResponseDto, description: '上传预签名地址' }
    })
    public async httpBaseSkylineGaragePresignUpload(@Body() input: GarageDto.PresignGarageObjectDto) {
        return this.garageService.httpBaseSkylineGaragePresignUpload(input)
    }

    @RequirePermissions(GARAGE_PERMISSION)
    @ApiServiceDecorator(Post('presign/download'), {
        operation: { summary: '生成 Garage 下载预签名地址' },
        request: { source: 'body', type: GarageDto.PresignGarageObjectDto },
        response: { type: GarageDto.GaragePresignResponseDto, description: '下载预签名地址' }
    })
    public async httpBaseSkylineGaragePresignDownload(@Body() input: GarageDto.PresignGarageObjectDto) {
        return this.garageService.httpBaseSkylineGaragePresignDownload(input)
    }

    @RequirePermissions(GARAGE_PERMISSION)
    @ApiConsumes('multipart/form-data')
    @ApiServiceDecorator(Post('object/upload'), {
        operation: { summary: '通过服务上传小文件到 Garage' },
        response: { type: GarageDto.GarageObjectResponseDto, description: '上传后的对象元数据' }
    })
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: GARAGE_MAX_UPLOAD_BYTES } }))
    public async httpBaseSkylineGarageObjectUpload(
        @UploadedFile() file: { buffer: Buffer; mimetype?: string; size: number },
        @Body() input: GarageDto.UploadGarageObjectDto
    ) {
        return this.garageService.httpBaseSkylineGarageObjectUpload(file, input)
    }
}
