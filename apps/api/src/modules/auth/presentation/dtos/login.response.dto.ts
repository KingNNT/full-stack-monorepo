import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class LoginResponseDto {
  @Expose({ name: 'access_token' })
  @ApiProperty({
    name: 'access_token',
    description: 'JWT access token (short-lived)',
  })
  accessToken!: string;

  @Expose({ name: 'refresh_token' })
  @ApiProperty({
    name: 'refresh_token',
    description: 'JWT refresh token (long-lived)',
  })
  refreshToken!: string;
}
