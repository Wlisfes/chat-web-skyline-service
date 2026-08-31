import { ApiProperty } from '@nestjs/swagger'

/**Skyline 服务存活检查响应。*/
export class SkylineLivenessResponseDto {
    @ApiProperty({ description: '服务状态', enum: ['UP'], example: 'UP' })
    status: 'UP'
}
