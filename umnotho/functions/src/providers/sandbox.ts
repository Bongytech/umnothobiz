import { isPaymentStatus, verifySandboxSignature } from '../core';
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
  WebhookEvent,
} from './types';

const DEFAULT_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEFAULT_NETWORK = 'Base Sepolia testnet';

/**
 * A local-only provider. It never moves funds and refuses to confirm anything
 * unless the Functions emulator or ALLOW_SANDBOX_PAYMENTS=true is active.
 */
export class SandboxProvider implements PaymentProvider {
  readonly id = 'sandbox';
  readonly label = 'Sandbox — no real funds';
  readonly sandbox = true;

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    return {
      provider: this.id,
      providerLabel: this.label,
      providerPaymentId: `sandbox_${request.paymentId}`,
      address: process.env.SANDBOX_USDT_ADDRESS || DEFAULT_ADDRESS,
      network: process.env.SANDBOX_NETWORK || DEFAULT_NETWORK,
    };
  }

  parseWebhook(rawBody: Buffer | string, signature: string): WebhookEvent {
    const secret = process.env.SANDBOX_WEBHOOK_SECRET ?? '';

    if (!secret) {
      throw new Error('SANDBOX_WEBHOOK_SECRET is not configured');
    }
    if (!verifySandboxSignature(rawBody, signature, secret)) {
      throw new Error('Invalid sandbox webhook signature');
    }

    const payload = JSON.parse(rawBody.toString()) as Record<string, unknown>;
    const paymentId = payload.paymentId;
    const status = payload.status;

    if (typeof paymentId !== 'string' || paymentId.length === 0) {
      throw new Error('Webhook payload is missing paymentId');
    }
    if (!isPaymentStatus(status) || status === 'pending') {
      throw new Error('Webhook payload has an unsupported status');
    }

    return {
      paymentId,
      status,
      txHash: typeof payload.txHash === 'string' ? payload.txHash : undefined,
      amountUsdt:
        typeof payload.amountUsdt === 'number' && Number.isFinite(payload.amountUsdt)
          ? payload.amountUsdt
          : undefined,
    };
  }
}
