import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { TbSkylineChunkDto, TbSkylineChunkStatus } from '@wlisfes/chat-web-base-schema/chat-web-skyline-mysql'
import { PageDto } from '@wlisfes/chat-web-base-schema/utils'
import { PageResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'

/** 枚举字典分页查询参数。 */
export class ListChunkDto extends IntersectionType(PageDto, PartialType(PickType(TbSkylineChunkDto, ['type', 'pid', 'status'] as const))) {}

/** 枚举字典主键参数。 */
export class ChunkKeyDto {
    @ApiProperty({ description: '枚举项主键', example: 10000 })
    @IsInt({ message: '枚举项主键必须是整数' })
    @Min(1, { message: '枚举项主键必须大于0' })
    keyId: number
}

/** 新增枚举字典参数。 */
export class CreateChunkDto extends PickType(TbSkylineChunkDto, [
    'pid',
    'type',
    'name',
    'value',
    'json',
    'sort',
    'status',
    'allowDelete',
    'allowUpdate'
] as const) {}

/** 更新枚举字典参数。 */
export class UpdateChunkDto extends IntersectionType(ChunkKeyDto, PartialType(CreateChunkDto)) {}

/** 枚举字典详情响应。 */
export class ChunkResponseDto extends TbSkylineChunkDto {}

/** 枚举字典分页响应。 */
export class ChunkPageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '枚举字典列表', type: [ChunkResponseDto] })
    list: ChunkResponseDto[]
}

/** 枚举字典删除响应。 */
export class DeleteChunkResponseDto {
    @ApiProperty({ description: '是否删除成功', example: true })
    success: true
}
