import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserProfileResponseDto {
  @Expose({ name: 'user_id' })
  @ApiProperty({ name: 'user_id', description: 'The user ID' })
  userId!: string;

  @Expose()
  @ApiProperty({ description: 'Email address' })
  email!: string;

  @Expose()
  @ApiProperty({ description: 'Username' })
  username!: string;

  @Expose({ name: 'is_active' })
  @ApiProperty({
    name: 'is_active',
    description: 'Whether the account is active',
  })
  isActive!: boolean;
}
