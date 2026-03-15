import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class RegisterResponseDto {
  @Expose({ name: 'user_id' })
  @ApiProperty({ name: 'user_id', description: 'The created user ID' })
  userId!: string;
}
