import { Global, Module } from '@nestjs/common';
import { TokenCryptoService } from './token-crypto.service';

/**
 * Global because "secrets at rest" is a cross-cutting concern: `auth` writes
 * provider tokens, `import` reads them. Two modules importing each other just
 * to share one service would be the worse trade.
 */
@Global()
@Module({
  providers: [TokenCryptoService],
  exports: [TokenCryptoService],
})
export class SecurityModule {}
