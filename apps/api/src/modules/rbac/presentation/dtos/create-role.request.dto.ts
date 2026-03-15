import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleRequestDto {
  @ApiProperty({
    description: 'Role name',
    example: 'editor',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({
    description: 'Role description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
