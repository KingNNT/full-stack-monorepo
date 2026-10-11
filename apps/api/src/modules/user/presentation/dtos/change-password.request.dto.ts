import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  type Locale,
  SUPPORTED_LOCALES,
} from '../../../../shared/domain/locale';

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

  @ApiProperty({ required: false, enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: Locale;
}
