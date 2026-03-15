import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({
    description: 'Email address or username',
    example: 'alice@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({
    description: 'Password',
    example: 'supersecret123',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
