import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChangePasswordCommand } from '../../../auth/application/commands/change-password/change-password.command';
import type { JwtPayload } from '../../../auth/application/ports/token.service.interface';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { UpdateProfileCommand } from '../../application/commands/update-profile/update-profile.command';
import type { UpdateProfileResult } from '../../application/commands/update-profile/update-profile.result';
import { GetProfileQuery } from '../../application/queries/get-profile/get-profile.query';
import type { GetProfileResult } from '../../application/queries/get-profile/get-profile.result';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ChangePasswordRequestDto } from '../dtos/change-password.request.dto';
import { UpdateProfileRequestDto } from '../dtos/update-profile.request.dto';
import { UserProfileResponseDto } from '../dtos/user-profile.response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  async getProfile(
    @CurrentUser() user: JwtPayload,
  ): Promise<UserProfileResponseDto> {
    const result = await this.queryBus.execute<
      GetProfileQuery,
      GetProfileResult
    >(new GetProfileQuery(user.sub));
    return this.toProfileDto(result);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, type: UserProfileResponseDto })
  @ApiResponse({ status: 409, description: 'Username already in use' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileRequestDto,
  ): Promise<UserProfileResponseDto> {
    const result = await this.commandBus.execute<
      UpdateProfileCommand,
      UpdateProfileResult
    >(new UpdateProfileCommand(user.sub, dto.username));

    const profile = await this.queryBus.execute<
      GetProfileQuery,
      GetProfileResult
    >(new GetProfileQuery(result.userId));
    return this.toProfileDto(profile);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({ status: 204, description: 'Password updated' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordRequestDto,
  ): Promise<void> {
    await this.commandBus.execute<ChangePasswordCommand, void>(
      new ChangePasswordCommand(user.sub, dto.old_password, dto.new_password),
    );
  }

  private toProfileDto(result: GetProfileResult): UserProfileResponseDto {
    const dto = new UserProfileResponseDto();
    dto.userId = result.userId;
    dto.email = result.email;
    dto.username = result.username;
    dto.isActive = result.isActive;
    return dto;
  }
}
