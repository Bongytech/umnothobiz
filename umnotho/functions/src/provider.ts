import { NowPaymentsProvider } from './providers/nowpayments';
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

export function projectId(): string {
  return process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? '';
}

/**
 * Sandbox settlement is never allowed merely because an env var is set. It
 * requires the emulator, or an explicitly allowlisted non-production project.
 */
export function sandboxAllowed(): boolean {
  if (isEmulator()) return true;
  if (process.env.ALLOW_SANDBOX_PAYMENTS !== 'true') return false;

  const project = projectId();
  const allowlist = (process.env.SANDBOX_PROJECT_ALLOWLIST ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const allowed = project.startsWith('demo-') || allowlist.includes(project);
  if (!allowed) {
    console.error(
      'ALLOW_SANDBOX_PAYMENTS=true is set on a production project, but sandbox is not allowlisted. Refusing sandbox settlement.',
    );
  }
  return allowed;
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

  if (name === 'nowpayments') {
    if (!isEmulator() && process.env.USE_SECRET_MANAGER !== 'true') {
      throw new Error(
        'Production NOWPayments requires Secret Manager. Set USE_SECRET_MANAGER=true and bind the API key/IPN secret.',
      );
    }
    return new NowPaymentsProvider();
  }

  throw new Error(`Unsupported crypto provider: ${name}`);
}
