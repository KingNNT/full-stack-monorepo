import type { PinoLogger } from 'nestjs-pino';

export function createMockPinoLogger(): jest.Mocked<
  Pick<PinoLogger, 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'fatal'>
> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  };
}
