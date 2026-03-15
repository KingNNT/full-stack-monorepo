import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePermissionRequestDto {
  @ApiPropertyOptional({
    description: 'Permission name',
    example: 'users.create',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Permission description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
