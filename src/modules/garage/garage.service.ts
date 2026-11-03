import { Injectable } from '@nestjs/common'
import { GarageUtilsService } from '@/modules/garage/garage.utils.service'
import * as GarageDto from '@/modules/garage/dto/garage.dto'

/** Skyline Garage 对象存储用例。只转调已注入客户端的工具方法，不直接创建 S3Client。 */
@Injectable()
export class GarageService {
    constructor(private readonly garageUtilsService: GarageUtilsService) {}

    /** 列出对象：POST /garage/object/column。 */
    public async httpBaseSkylineColumnGarageObject(input: GarageDto.ListGarageObjectDto) {
        return this.garageUtilsService.list(input)
    }

    /** 查询对象元数据：GET /garage/object/resolve。 */
    public async httpBaseSkylineGarageObjectResolver(input: GarageDto.GarageObjectKeyDto) {
        return this.garageUtilsService.head(input.key)
    }

    /** 删除对象：POST /garage/object/delete。 */
    public async httpBaseSkylineGarageObjectDelete(input: GarageDto.GarageObjectKeyDto) {
        return this.garageUtilsService.remove(input.key)
    }

    /** 生成上传预签名：POST /garage/presign/upload。 */
    public async httpBaseSkylineGaragePresignUpload(input: GarageDto.PresignGarageObjectDto) {
        return this.garageUtilsService.presign('PUT', input)
    }

    /** 生成下载预签名：POST /garage/presign/download。 */
    public async httpBaseSkylineGaragePresignDownload(input: GarageDto.PresignGarageObjectDto) {
        return this.garageUtilsService.presign('GET', input)
    }

    /** 经服务上传不超过 20MB 的文件：POST /garage/object/upload。 */
    public async httpBaseSkylineGarageObjectUpload(file: GarageDto.UploadedObjectFile, input: GarageDto.UploadGarageObjectDto) {
        return this.garageUtilsService.put(file, input.key, input.contentType)
    }
}
