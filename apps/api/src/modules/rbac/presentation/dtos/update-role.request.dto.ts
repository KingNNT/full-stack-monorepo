import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRoleRequestDto {
  @ApiPropertyOptional({
    description: 'Role name',
    example: 'editor',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    description: 'Role description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
