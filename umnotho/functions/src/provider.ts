import { SandboxProvider } from './providers/sandbox';
import type { PaymentProvider } from './providers/types';

export function isEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true';
}

export function providerName(): string {
  return process.env.CRYPTO_PROVIDER || (isEmulator() ? 'sandbox' : '');
}

export function isSandbox(): boolean {
  return providerName() === 'sandbox';
}

export function sandboxAllowed(): boolean {
  return isEmulator() || process.env.ALLOW_SANDBOX_PAYMENTS === 'true';
}

/**
 * Resolves the configured provider. A deployed function with no provider is
 * deliberately unusable: we never fall back to a fake "paid" result.
 */
export function getProvider(): PaymentProvider {
  const name = providerName();

  if (!name) {
    throw new Error(
      'Crypto payments are not configured. Set CRYPTO_PROVIDER and deploy a provider adapter.',
    );
  }

  if (name === 'sandbox') {
    if (!sandboxAllowed()) {
      throw new Error(
        'Sandbox payments are disabled. Set ALLOW_SANDBOX_PAYMENTS=true only for local testing.',
      );
    }
    return new SandboxProvider();
  }

  throw new Error(`Unsupported crypto provider: ${name}`);
}
