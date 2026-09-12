import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env, isProduction } from '../../config/env';

/**
 * Encrypts provider OAuth tokens at rest.
 *
 * GitHub hands us a token with `repo` scope — enough to read private code —
 * and until now it sat in the database in plaintext, so a leaked backup or a
 * readable `.sql` dump was a GitHub-account breach, not just a DevVault one.
 * AES-256-GCM with a key from `OAUTH_ENCRYPTION_KEY` means the database alone
 * is no longer enough.
 *
 * Deliberately small and not a general-purpose KMS:
 *  - The key is a 32-byte hex string, supplied by the operator. It is *not*
 *    derived from the JWT secret (different secret, different job).
 *  - No key rotation support: rotating means re-encrypting existing rows,
 *    which is out of scope for a project with one OAuth token per user.
 *  - Values written before the key existed stay readable. `decrypt` recognizes
 *    its own prefix and passes anything else through untouched, so an existing
 *    local database keeps working without a backfill.
 *  - When no key is configured, this is a no-op (plus one warning at boot) so
 *    `npm run start:dev` never fails for a missing optional secret.
 */
const PREFIX = 'v1';

@Injectable()
export class TokenCryptoService {
  private readonly logger = new Logger(TokenCryptoService.name);
  private readonly key: Buffer | null;

  constructor() {
    this.key = TokenCryptoService.parseKey(env.oauthEncryptionKey);
    if (!this.key) {
      const message =
        'OAUTH_ENCRYPTION_KEY is not set — OAuth provider tokens will be stored in plaintext. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
      if (isProduction) {
        this.logger.error(message);
      } else {
        this.logger.warn(message);
      }
    }
  }

  private static parseKey(raw: string | undefined): Buffer | null {
    if (!raw) return null;
    const buffer = Buffer.from(raw, 'hex');
    // 32 bytes of hex = 64 chars. Anything else is a typo, not a different key size.
    if (buffer.length !== 32) {
      throw new Error('OAUTH_ENCRYPTION_KEY must be 32 bytes of hex (64 characters)');
    }
    return buffer;
  }

  get enabled(): boolean {
    return this.key !== null;
  }

  /** Idempotent: already-encrypted values are returned unchanged. */
  encrypt(plaintext: string | null | undefined): string | null {
    if (!plaintext) return null;
    if (!this.key || plaintext.startsWith(`${PREFIX}:`)) return plaintext ?? null;

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [PREFIX, iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':');
  }

  /**
   * Returns the stored value unchanged when it isn't one of ours (a row written
   * before encryption was configured). A *malformed* payload of ours throws —
   * that means a corrupted or tampered token, which the caller surfaces as
   * "reconnect GitHub" rather than using garbage as a bearer token.
   */
  decrypt(stored: string | null | undefined): string | null {
    if (!stored) return null;
    if (!stored.startsWith(`${PREFIX}:`)) return stored;
    if (!this.key) {
      throw new Error('An OAuth token is encrypted but OAUTH_ENCRYPTION_KEY is not set');
    }

    const [, iv, tag, ciphertext] = stored.split(':');
    if (!iv || !tag || !ciphertext) throw new Error('Malformed encrypted OAuth token');

    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
    } catch {
      throw new Error('Unable to decrypt the stored OAuth token (wrong key, or the row was tampered with)');
    }
  }
}
