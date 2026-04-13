import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordRequestDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  old_password!: string;

  @ApiProperty({ description: 'New password (min 8 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  new_password!: string;
}
