import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignPermissionRequestDto {
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

  @ApiProperty({ description: 'Permission ID' })
  @IsUUID()
  @IsNotEmpty()
  permission_id!: string;
}
