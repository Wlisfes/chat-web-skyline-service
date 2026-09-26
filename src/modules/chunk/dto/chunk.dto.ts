import { ApiProperty, IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'
import { EnumsResponseDto, PageResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import * as Schema from '@wlisfes/chat-web-base-schema'

import { PageDto } from '@wlisfes/chat-web-base-schema/utils'
/** 枚举字典分页查询参数。 */
export class ListChunkDto extends IntersectionType(
    PageDto,
    PartialType(PickType(Schema.TbSkylineChunkDto, ['module', 'type', 'name', 'pid', 'status'] as const))
) {}

/** 枚举分类分页查询参数；分类数据由 SQL 种子维护，接口只提供列表。 */
export class ListChunkModuleDto extends IntersectionType(
    PageDto,
    PartialType(PickType(Schema.TbSkylineChunkModuleDto, ['module', 'name', 'kind'] as const))
) {}

/** 枚举字典主键参数。 */
export class ChunkKeyDto {
    @ApiProperty({ description: '枚举项主键', example: 10000 })
    @Type(() => Number)
    @IsInt({ message: '枚举项主键必须是整数' })
    @Min(1, { message: '枚举项主键必须大于0' })
    keyId: number
}

/** 新增枚举字典参数。 */
export class CreateChunkDto extends PickType(Schema.TbSkylineChunkDto, [
    'pid',
    'module',
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
export class ChunkResponseDto extends Schema.TbSkylineChunkDto {}

/** 枚举字典分页响应。 */
export class ChunkPageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '枚举字典列表', type: [ChunkResponseDto] })
    list: ChunkResponseDto[]
}

/** 枚举分类详情响应。 */
export class ChunkModuleResponseDto extends Schema.TbSkylineChunkModuleDto {
    @ApiProperty({ description: '子表枚举项数量，按 module + type 联查 tb_skyline_chunk', example: 65, readOnly: true })
    chunkCount: number
}

/** 枚举分类分页响应。 */
export class ChunkModulePageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '枚举分类列表', type: [ChunkModuleResponseDto] })
    list: ChunkModuleResponseDto[]
}

/** 枚举字典删除响应。 */
export class DeleteChunkResponseDto {
    @ApiProperty({ description: '是否删除成功', example: true })
    success: true
}

/** 枚举字典静态枚举响应。 */
export class ChunkEnumsResponseDto extends EnumsResponseDto({
    moduleOptions: { description: '枚举所属模块选项', example: Schema.TbSkylineChunkModuleDefinition.options },
    kindOptions: { description: '枚举字段类型选项', example: Schema.TbSkylineChunkModuleKindDefinition.options },
    statusOptions: { description: '枚举项状态选项', example: Schema.TbSkylineChunkStatusDefinition.options }
}) {}
