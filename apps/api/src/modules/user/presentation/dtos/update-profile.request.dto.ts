import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileRequestDto {
  @ApiProperty({
    description: 'Username (3-30 chars, alphanumeric/underscore)',
    example: 'alice_42',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  username!: string;
}
