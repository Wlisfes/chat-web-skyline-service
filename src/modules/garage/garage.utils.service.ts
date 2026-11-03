import { BadGatewayException, BadRequestException, Inject, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ListObjectsV2Command, PutObjectCommand, S3ServiceException } from '@aws-sdk/client-s3'
import { type GarageConfig } from '@/modules/garage/garage.options'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import * as GarageConst from '@/modules/garage/garage.constants'
import * as GarageDto from '@/modules/garage/dto/garage.dto'

/** 对象元数据。etag 已去掉首尾引号。 */
export interface GarageObjectMetadata {
    key: string
    size: number
    contentType: string
    etag: string
    lastModified: string
}

/** 列表中的单个对象。 */
export interface GarageListedObject {
    key: string
    size: number
    etag: string
    lastModified: string
    storageClass: string
}

/** 按前缀列出的对象和子目录。 */
export interface GarageListResult {
    prefix: string
    delimiter: string
    isTruncated: boolean
    nextContinuationToken?: string
    objects: GarageListedObject[]
    prefixes: string[]
}

/** 经 multipart 上传的文件内容。 */
interface UploadedObjectFile {
    buffer: Buffer
    mimetype?: string
    size: number
}

/** 校验对象键，拒绝路径穿越和空键。 */
export function normalizeObjectKey(value: string): string {
    const key = value?.trim() ?? ''
    if (!key) {
        throw new BadRequestException('对象键不能为空')
    }
    if (key.length > 1024) {
        throw new BadRequestException('对象键不能超过1024个字符')
    }
    if (key.startsWith('/') || key.includes('\\') || key.split('/').includes('..')) {
        throw new BadRequestException('对象键不能以斜杠开头，也不能包含路径穿越')
    }
    if (hasControlCharacter(key)) {
        throw new BadRequestException('对象键包含非法字符')
    }
    return key
}

/** 校验列表前缀。空前缀表示从桶根开始。 */
export function normalizePrefix(value?: string): string {
    if (value == null || value.trim() === '') {
        return ''
    }
    return normalizeObjectKey(value)
}

/** 拒绝 ASCII 控制字符，避免对象键被截断或注入。 */
function hasControlCharacter(value: string): boolean {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        if (code <= 31 || code === 127) {
            return true
        }
    }
    return false
}

/** 使用已注入的 S3 客户端执行 Garage 操作。 */
@Injectable()
export class GarageUtilsService {
    constructor(
        private readonly s3: S3Client,
        @Inject(GarageConst.PUBLIC_S3) private readonly publicS3: S3Client,
        @Inject(GarageConst.S3_CONFIG) private readonly config: GarageConfig
    ) {}

    /** 按前缀列出对象。delimiter 不传时按 / 分组。 */
    public async list(input: GarageDto.ListGarageObjectDto): Promise<GarageListResult> {
        const prefix = normalizePrefix(input.prefix)
        const delimiter = input.delimiter == null ? '/' : input.delimiter
        const result = await this.s3.send(
            new ListObjectsV2Command({
                Bucket: this.config.bucket,
                Prefix: prefix || undefined,
                Delimiter: delimiter || undefined,
                MaxKeys: input.maxKeys ?? 100,
                ContinuationToken: input.continuationToken || undefined
            })
        )
        return {
            prefix,
            delimiter,
            isTruncated: result.IsTruncated === true,
            nextContinuationToken: result.NextContinuationToken || undefined,
            objects: (result.Contents ?? []).map(item => ({
                key: item.Key || '',
                size: item.Size ?? 0,
                etag: (item.ETag || '').replace(/^"|"$/g, ''),
                lastModified: item.LastModified?.toISOString() || '',
                storageClass: item.StorageClass || 'STANDARD'
            })),
            prefixes: (result.CommonPrefixes ?? []).map(item => item.Prefix || '').filter(Boolean)
        }
    }

    /** 查询对象元数据。不存在时返回 404。 */
    public async head(key: string): Promise<GarageObjectMetadata> {
        const objectKey = normalizeObjectKey(key)
        try {
            const result = await this.s3.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: objectKey }))
            return this.metadata(
                objectKey,
                result.ContentLength ?? 0,
                result.ContentType || '',
                result.ETag || '',
                result.LastModified?.toISOString() || ''
            )
        } catch (error) {
            throw this.toException(error)
        }
    }

    /** 删除对象。Garage 对不存在的键通常仍返回成功。 */
    public async remove(key: string): Promise<{ key: string; deleted: boolean }> {
        const objectKey = normalizeObjectKey(key)
        try {
            await this.s3.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: objectKey }))
            return { key: objectKey, deleted: true }
        } catch (error) {
            throw this.toException(error)
        }
    }

    /** 经服务写入小文件。超过上限时要求改用预签名。 */
    public async put(file: UploadedObjectFile, key: string, contentType?: string): Promise<GarageObjectMetadata> {
        if (!file?.buffer?.length) {
            throw new BadRequestException('上传文件不能为空')
        }
        if (file.size > GarageConst.GARAGE_MAX_UPLOAD_BYTES) {
            throw new PayloadTooLargeException('通过服务上传的文件不能超过20MB，请改用预签名上传')
        }
        const objectKey = normalizeObjectKey(key)
        const type = contentType || file.mimetype || 'application/octet-stream'
        try {
            const result = await this.s3.send(
                new PutObjectCommand({ Bucket: this.config.bucket, Key: objectKey, Body: file.buffer, ContentType: type })
            )
            return this.metadata(objectKey, file.size, type, result.ETag || '', new Date().toISOString())
        } catch (error) {
            throw this.toException(error)
        }
    }

    /** 用公网客户端生成预签名。上传时把 content-type 纳入签名。 */
    public async presign(method: 'GET' | 'PUT', input: GarageDto.PresignGarageObjectDto): Promise<GarageDto.GaragePresignResponseDto> {
        const objectKey = normalizeObjectKey(input.key)
        const expiresIn = input.expiresIn == null ? GarageConst.GARAGE_DEFAULT_EXPIRES_IN : input.expiresIn
        const contentType = method === 'PUT' ? input.contentType : undefined
        const command =
            method === 'PUT'
                ? new PutObjectCommand({ Bucket: this.config.bucket, Key: objectKey, ContentType: contentType })
                : new GetObjectCommand({ Bucket: this.config.bucket, Key: objectKey })
        const url = await getSignedUrl(this.publicS3, command, {
            expiresIn,
            signableHeaders: contentType ? new Set(['content-type']) : undefined
        })
        return {
            url,
            method,
            headers: contentType ? { 'content-type': contentType } : {},
            expiresAt: new Date(Date.now() + Math.min(expiresIn, GarageConst.GARAGE_MAX_EXPIRES_IN) * 1000).toISOString(),
            bucket: this.config.bucket,
            key: objectKey
        }
    }

    /** 去掉 ETag 引号，统一成对外元数据。 */
    private metadata(key: string, size: number, contentType: string, etag: string, lastModified: string): GarageObjectMetadata {
        return { key, size, contentType, etag: etag.replace(/^"|"$/g, ''), lastModified }
    }

    /** 把 S3 SDK 错误转成中文 HTTP 异常。已是业务异常的原样抛出。 */
    private toException(error: unknown): Error {
        if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof PayloadTooLargeException) {
            return error
        }
        const sdkError = error as S3ServiceException
        const status = sdkError.$metadata?.httpStatusCode
        const name = sdkError.name
        const message = sdkError.message || 'Garage 请求失败'
        if (status === 404 || name === 'NotFound' || name === 'NoSuchKey') {
            return new NotFoundException('对象不存在')
        }
        if (status != null && status >= 400 && status < 500) {
            return new BadRequestException(message)
        }
        if (status != null && status >= 500) {
            return new BadGatewayException('Garage 暂时不可用：' + message)
        }
        return new BadGatewayException('Garage 请求失败：' + message)
    }
}
