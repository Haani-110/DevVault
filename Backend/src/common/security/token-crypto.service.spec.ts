import { TokenCryptoService } from './token-crypto.service';

/**
 * The contract this service has to honour, in both directions:
 *
 *  - a stored value must not contain the provider token in plaintext;
 *  - values stored *before* encryption was configured must still work, so an
 *    existing local database does not need a backfill migration;
 *  - a value that looks like ours but is not (tampered, or encrypted under a
 *    different key) must throw rather than hand a broken string to GitHub.
 */
describe('TokenCryptoService', () => {
  const service = new TokenCryptoService();

  it('has encryption enabled when a 32-byte key is configured', () => {
    expect(service.enabled).toBe(true);
  });

  it('does not leave the token in the stored value', () => {
    const stored = service.encrypt('ghp_supersecrettoken123');

    expect(stored).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/);
    expect(stored).not.toContain('ghp_supersecrettoken123');
  });

  it('round-trips a value through encrypt/decrypt', () => {
    const secret = 'gho_' + 'x'.repeat(36);
    expect(service.decrypt(service.encrypt(secret))).toBe(secret);
  });

  it('produces a different ciphertext each time (fresh IV per call)', () => {
    expect(service.encrypt('same-input')).not.toBe(service.encrypt('same-input'));
  });

  it('is idempotent — an already encrypted value passes through unchanged', () => {
    const stored = service.encrypt('token')!;
    expect(service.encrypt(stored)).toBe(stored);
  });

  it('returns null for empty input, so a provider without a refresh token stays null', () => {
    expect(service.encrypt(null)).toBeNull();
    expect(service.encrypt(undefined)).toBeNull();
    expect(service.encrypt('')).toBeNull();
    expect(service.decrypt(null)).toBeNull();
  });

  it('reads legacy plaintext rows unchanged', () => {
    expect(service.decrypt('ghp_written_before_the_key_existed')).toBe('ghp_written_before_the_key_existed');
  });

  it('throws on a malformed payload instead of returning garbage', () => {
    expect(() => service.decrypt('v1:only:twoparts')).toThrow(/Malformed/);
  });

  it('throws when a ciphertext is tampered with', () => {
    const [, iv, tag, ciphertext] = service.encrypt('ghp_token')!.split(':');
    // Same shape, different bytes: GCM's auth tag is what catches this.
    const flipped = `${ciphertext.slice(0, -2)}${ciphertext.slice(-2) === 'AA' ? 'BB' : 'AA'}`;

    expect(() => service.decrypt(['v1', iv, tag, flipped].join(':'))).toThrow(/Unable to decrypt/);
  });

  it('cannot read a value written under a different key', () => {
    const stored = service.encrypt('ghp_token')!;
    const saved = process.env.OAUTH_ENCRYPTION_KEY;
    process.env.OAUTH_ENCRYPTION_KEY = 'ff'.repeat(32);

    try {
      let other: TokenCryptoService | undefined;
      jest.isolateModules(() => {
        other = new (require('./token-crypto.service').TokenCryptoService)();
      });

      expect(() => other!.decrypt(stored)).toThrow(/Unable to decrypt/);
    } finally {
      process.env.OAUTH_ENCRYPTION_KEY = saved;
    }
  });

  describe('without a configured key', () => {
    it('is a no-op so a default local checkout still boots and signs in', () => {
      const saved = process.env.OAUTH_ENCRYPTION_KEY;
      delete process.env.OAUTH_ENCRYPTION_KEY;

      try {
        let disabled: TokenCryptoService | undefined;
        jest.isolateModules(() => {
          // env.ts reads process.env at import time, so both modules have to be
          // re-evaluated for the missing key to take effect.
          const { TokenCryptoService: Fresh } = require('./token-crypto.service');
          disabled = new Fresh();
        });

        expect(disabled!.enabled).toBe(false);
        expect(disabled!.encrypt('ghp_token')).toBe('ghp_token');
        expect(disabled!.decrypt('ghp_token')).toBe('ghp_token');
      } finally {
        process.env.OAUTH_ENCRYPTION_KEY = saved;
      }
    });
  });

  describe('key validation', () => {
    it('rejects a key that is not 32 bytes of hex', () => {
      const saved = process.env.OAUTH_ENCRYPTION_KEY;
      process.env.OAUTH_ENCRYPTION_KEY = 'too-short';

      try {
        expect(() => {
          jest.isolateModules(() => {
            const { TokenCryptoService: Fresh } = require('./token-crypto.service');
            new Fresh();
          });
        }).toThrow(/32 bytes of hex/);
      } finally {
        process.env.OAUTH_ENCRYPTION_KEY = saved;
      }
    });
  });
});
