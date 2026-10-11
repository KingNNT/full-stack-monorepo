import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { IResetTokenGenerator } from '../../application/ports/reset-token-generator.interface';

@Injectable()
export class CryptoResetTokenGenerator implements IResetTokenGenerator {
  generate(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  // High-entropy token, looked up by hash: SHA-256 is enough, no bcrypt needed
  hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
