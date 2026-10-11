import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import type { TokenPair } from '../../application/ports/token.service.interface';

@Exclude()
export class TokenPairResponseDto {
  @Expose({ name: 'access_token' })
  @ApiProperty({ name: 'access_token', description: 'JWT access token' })
  accessToken!: string;

  @Expose({ name: 'refresh_token' })
  @ApiProperty({ name: 'refresh_token', description: 'JWT refresh token' })
  refreshToken!: string;

  static from(pair: TokenPair): TokenPairResponseDto {
    const dto = new TokenPairResponseDto();
    dto.accessToken = pair.accessToken;
    dto.refreshToken = pair.refreshToken;
    return dto;
  }
}
