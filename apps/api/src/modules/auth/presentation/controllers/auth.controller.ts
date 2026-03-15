import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginCommand } from '../../application/commands/login/login.command';
import type { LoginResult } from '../../application/commands/login/login.result';
import { RegisterCommand } from '../../application/commands/register/register.command';
import type { RegisterResult } from '../../application/commands/register/register.result';
import type { LoginRequestDto } from '../dtos/login.request.dto';
import { LoginResponseDto } from '../dtos/login.response.dto';
import type { RegisterRequestDto } from '../dtos/register.request.dto';
import { RegisterResponseDto } from '../dtos/register.response.dto';

@ApiTags('auth')
@Throttle({ default: { ttl: 60000, limit: 5 } })
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
}
