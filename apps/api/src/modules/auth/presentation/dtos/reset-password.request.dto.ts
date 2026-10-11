import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  type Locale,
  SUPPORTED_LOCALES,
} from '../../../../shared/domain/locale';

export class ResetPasswordRequestDto {
  @ApiProperty({ description: 'Token from the reset link' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;

  // Length is enforced by the handler so it can answer WEAK_PASSWORD
  @ApiProperty({ description: 'New password (8-128 characters)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  new_password!: string;

  @ApiProperty({ required: false, enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;
}
