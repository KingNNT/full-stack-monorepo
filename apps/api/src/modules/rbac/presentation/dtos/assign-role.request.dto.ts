import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignRoleRequestDto {
  @ApiProperty({
    description: 'Model type',
    example: 'user',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  model_type!: string;

  @ApiProperty({ description: 'Model ID' })
  @IsUUID()
  @IsNotEmpty()
  model_id!: string;

  @ApiProperty({ description: 'Role ID' })
  @IsUUID()
  @IsNotEmpty()
  role_id!: string;
}
