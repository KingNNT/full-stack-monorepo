import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../user/presentation/decorators/current-user.decorator';
import { LoginCommand } from '../../application/commands/login/login.command';
import type { LoginResult } from '../../application/commands/login/login.result';
import { RefreshTokenCommand } from '../../application/commands/refresh-token/refresh-token.command';
import { RegisterCommand } from '../../application/commands/register/register.command';
import type { RegisterResult } from '../../application/commands/register/register.result';
import { RequestPasswordResetCommand } from '../../application/commands/request-password-reset/request-password-reset.command';
import { ResetPasswordCommand } from '../../application/commands/reset-password/reset-password.command';
import type {
  JwtPayload,
  TokenPair,
} from '../../application/ports/token.service.interface';
import { ForgotPasswordRequestDto } from '../dtos/forgot-password.request.dto';
import { LoginRequestDto } from '../dtos/login.request.dto';
import { LoginResponseDto } from '../dtos/login.response.dto';
import { RegisterRequestDto } from '../dtos/register.request.dto';
import { RegisterResponseDto } from '../dtos/register.response.dto';
import { ResetPasswordRequestDto } from '../dtos/reset-password.request.dto';
import { TokenPairResponseDto } from '../dtos/token-pair.response.dto';
import { JwtRefreshGuard } from '../guards/jwt-refresh.guard';

const THROTTLE_OFF = process.env.THROTTLE_DISABLED === 'true';

@ApiTags('Auth')
@Throttle({
  default: {
    ttl: 60000,
    limit: THROTTLE_OFF ? 100_000 : 5,
  },
})
@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: RegisterResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async register(
    @Body() dto: RegisterRequestDto,
  ): Promise<RegisterResponseDto> {
    const result = await this.commandBus.execute<
      RegisterCommand,
      RegisterResult
    >(new RegisterCommand(dto.email, dto.username, dto.password));
    const response = new RegisterResponseDto();
    response.userId = result.userId;
    return response;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email or username + password' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginRequestDto): Promise<LoginResponseDto> {
    const result = await this.commandBus.execute<LoginCommand, LoginResult>(
      new LoginCommand(dto.identifier, dto.password),
    );
    const response = new LoginResponseDto();
    response.accessToken = result.accessToken;
    response.refreshToken = result.refreshToken;
    return response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiResponse({ status: 200, type: TokenPairResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or revoked session' })
  async refresh(
    @CurrentUser() user: JwtPayload,
  ): Promise<TokenPairResponseDto> {
    const pair = await this.commandBus.execute<RefreshTokenCommand, TokenPair>(
      new RefreshTokenCommand(user.sub, user.tv),
    );
    return TokenPairResponseDto.from(pair);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60000, limit: THROTTLE_OFF ? 100_000 : 3 } })
  @ApiOperation({
    summary:
      'Email a password reset link; always 202 so emails are not disclosed',
  })
  @ApiResponse({ status: 202 })
  async forgotPassword(
    @Body() dto: ForgotPasswordRequestDto,
  ): Promise<Record<string, never>> {
    await this.commandBus.execute(
      new RequestPasswordResetCommand(dto.email, dto.locale ?? 'en'),
    );
    return {};
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: THROTTLE_OFF ? 100_000 : 5 } })
  @ApiOperation({ summary: 'Set a new password with a reset token' })
  @ApiResponse({ status: 200 })
  @ApiResponse({
    status: 400,
    description: 'INVALID_RESET_TOKEN or WEAK_PASSWORD',
  })
  async resetPassword(
    @Body() dto: ResetPasswordRequestDto,
  ): Promise<Record<string, never>> {
    await this.commandBus.execute(
      new ResetPasswordCommand(dto.token, dto.new_password, dto.locale ?? 'en'),
    );
    return {};
  }
}
