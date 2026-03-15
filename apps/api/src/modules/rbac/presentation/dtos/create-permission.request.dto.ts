import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePermissionRequestDto {
  @ApiProperty({
    description: 'Permission name',
    example: 'users.create',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Permission description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
