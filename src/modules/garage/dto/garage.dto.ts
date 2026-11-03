import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

/** 经 multipart 上传的文件内容。字段名为 file。 */
export interface UploadedObjectFile {
    buffer: Buffer
    mimetype?: string
    size: number
}

/** 列出对象入参：POST /garage/object/column。 */
export class ListGarageObjectDto {
    @ApiPropertyOptional({ description: '对象键前缀，用于按目录筛选', example: 'healthcheck/' })
    @IsOptional()
    @IsString({ message: '对象键前缀必须是字符串' })
    @MaxLength(1024, { message: '对象键前缀不能超过1024个字符' })
    prefix?: string

    @ApiPropertyOptional({ description: '分组分隔符。传空字符串表示不分组，不传默认使用 /', example: '/' })
    @IsOptional()
    @IsString({ message: '分组分隔符必须是字符串' })
    @MaxLength(8, { message: '分组分隔符过长' })
    delimiter?: string

    @ApiPropertyOptional({ description: '单次返回的最大对象数', example: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: '最大对象数必须是整数' })
    @Min(1, { message: '最大对象数必须大于0' })
    @Max(1000, { message: '最大对象数不能超过1000' })
    maxKeys?: number

    @ApiPropertyOptional({ description: '上一页返回的续传标记' })
    @IsOptional()
    @IsString({ message: '续传标记必须是字符串' })
    @MaxLength(2048, { message: '续传标记过长' })
    continuationToken?: string
}

/** 对象键入参。用于查询和删除。 */
export class GarageObjectKeyDto {
    @ApiProperty({ description: '对象键', example: 'healthcheck/public.txt' })
    @IsString({ message: '对象键必须是字符串' })
    @IsNotEmpty({ message: '对象键不能为空' })
    @MaxLength(1024, { message: '对象键不能超过1024个字符' })
    key: string
}

/** 预签名入参。浏览器使用返回的公网地址直接访问 Garage，不经过业务 Gateway。 */
export class PresignGarageObjectDto extends GarageObjectKeyDto {
    @ApiPropertyOptional({ description: '链接有效秒数，范围 60 到 86400', example: 900 })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: '有效秒数必须是整数' })
    @Min(60, { message: '有效秒数不能少于60' })
    @Max(86400, { message: '有效秒数不能超过86400' })
    expiresIn?: number

    @ApiPropertyOptional({ description: '上传时要求客户端携带的 Content-Type', example: 'text/plain' })
    @IsOptional()
    @IsString({ message: 'Content-Type 必须是字符串' })
    @MaxLength(200, { message: 'Content-Type 过长' })
    contentType?: string
}

/** 服务端上传表单字段。文件本体使用 multipart 字段 file。 */
export class UploadGarageObjectDto extends GarageObjectKeyDto {
    @ApiPropertyOptional({ description: '对象 Content-Type，不传则使用上传文件的类型', example: 'application/octet-stream' })
    @IsOptional()
    @IsString({ message: 'Content-Type 必须是字符串' })
    @MaxLength(200, { message: 'Content-Type 过长' })
    contentType?: string
}

/** 对象列表项。 */
export class GarageObjectItemResponseDto {
    @ApiProperty({ description: '对象键', example: 'healthcheck/public.txt' })
    key: string

    @ApiProperty({ description: '对象大小，单位字节', example: 12 })
    size: number

    @ApiProperty({ description: 'ETag', example: 'd41d8cd98f00b204e9800998ecf8427e' })
    etag: string

    @ApiProperty({ description: '最后修改时间', example: '2026-11-03T00:00:00.000Z' })
    lastModified: string

    @ApiProperty({ description: '存储类型', example: 'STANDARD' })
    storageClass: string
}

/** 列出对象响应：POST /garage/object/column。 */
export class GarageObjectPageResponseDto {
    @ApiProperty({ description: '当前前缀', example: 'healthcheck/' })
    prefix: string

    @ApiProperty({ description: '当前分组分隔符', example: '/' })
    delimiter: string

    @ApiProperty({ description: '是否还有下一页', example: false })
    isTruncated: boolean

    @ApiPropertyOptional({ description: '下一页续传标记' })
    nextContinuationToken?: string

    @ApiProperty({ description: '对象列表', type: [GarageObjectItemResponseDto] })
    objects: GarageObjectItemResponseDto[]

    @ApiProperty({ description: '子前缀列表', type: [String], example: ['healthcheck/'] })
    prefixes: string[]
}

/** 对象元数据响应：GET /garage/object/resolve、POST /garage/object/upload。 */
export class GarageObjectResponseDto {
    @ApiProperty({ description: '对象键', example: 'healthcheck/public.txt' })
    key: string

    @ApiProperty({ description: '对象大小，单位字节', example: 12 })
    size: number

    @ApiProperty({ description: 'Content-Type', example: 'text/plain' })
    contentType: string

    @ApiProperty({ description: 'ETag', example: 'd41d8cd98f00b204e9800998ecf8427e' })
    etag: string

    @ApiProperty({ description: '最后修改时间', example: '2026-11-03T00:00:00.000Z' })
    lastModified: string
}

/** 预签名响应：POST /garage/presign/upload、POST /garage/presign/download。 */
export class GaragePresignResponseDto {
    @ApiProperty({ description: '可直接访问的预签名地址', example: 'https://chat-web-garage.lisfes.cn/chat-web/healthcheck/public.txt' })
    url: string

    @ApiProperty({ description: '请求方法', example: 'PUT', enum: ['GET', 'PUT'] })
    method: 'GET' | 'PUT'

    @ApiProperty({ description: '客户端必须携带的请求头。未签名的头不要额外添加', example: { 'content-type': 'text/plain' } })
    headers: Record<string, string>

    @ApiProperty({ description: '链接失效时间', example: '2026-11-03T01:15:00.000Z' })
    expiresAt: string

    @ApiProperty({ description: '存储桶', example: 'chat-web' })
    bucket: string

    @ApiProperty({ description: '对象键', example: 'healthcheck/public.txt' })
    key: string
}

/** 删除对象响应：POST /garage/object/delete。 */
export class GarageDeleteResponseDto {
    @ApiProperty({ description: '对象键', example: 'healthcheck/public.txt' })
    key: string

    @ApiProperty({ description: '是否已删除', example: true })
    deleted: boolean
}
