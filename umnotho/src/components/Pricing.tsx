import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Wallet,
  X,
} from 'lucide-react';
import AppNav from './AppNav';
import SiteFooter from './SiteFooter';
import { useAuth } from '../contexts/AuthContext';
import { functions } from '../lib/firebase';
import type { CryptoCheckout } from '../lib/crypto';
import { checkoutIsExpired, formatUsdt, formatZar } from '../lib/crypto';

interface Plan {
  name: string;
  description: string;
  price: string;
  period?: string;
  features: string[];
  buttonLabel: string;
  tier: 'free' | 'basic' | 'biz';
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Freemium',
    description: 'Browse the market and trade individual items.',
    price: 'Free',
    features: ['Access to public listings', 'Pay per transaction', 'Community ratings'],
    buttonLabel: 'Start trading',
    tier: 'free',
  },
  {
    name: 'Basic',
    description: 'For regular traders who want unlimited individual trades.',
    price: 'R 49',
    period: 'month',
    features: [
      'Unlimited individual trades',
      'Business listings with transaction fee',
      'Priority placement in search',
    ],
    buttonLabel: 'Pay with USDT',
    tier: 'basic',
    popular: true,
  },
  {
    name: 'Biz',
    description: 'For businesses trading goods and services at volume.',
    price: 'R 97',
    period: 'month',
    features: [
      'Unlimited individual and business trades',
      'Business profile badge',
      'Priority support',
    ],
    buttonLabel: 'Pay with USDT',
    tier: 'biz',
  },
];

type Notice = { tone: 'success' | 'error' | 'info'; text: string };

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  if (
    /not configured|not available|disabled|failed to fetch|internal|not-found|unavailable/i.test(
      message,
    )
  ) {
    return 'Crypto checkout is not available in this environment. Deploy the Cloud Functions, or run the Firebase emulators locally.';
  }
  if (/unauthenticated|sign in/i.test(message)) {
    return 'Please sign in before starting a crypto checkout.';
  }

  return message || 'Could not start the crypto checkout. Please try again.';
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [checkout, setCheckout] = useState<CryptoCheckout | null>(null);
  const [startingPlan, setStartingPlan] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [verificationNote, setVerificationNote] = useState('');

  const pendingPaymentId =
    checkout && checkout.status === 'pending' ? checkout.paymentId : null;

  const readCheckout = useCallback(async (paymentId: string): Promise<CryptoCheckout> => {
    const getCheckout = httpsCallable<{ paymentId: string }, CryptoCheckout>(
      functions,
      'getCryptoCheckout',
    );
    const result = await getCheckout({ paymentId });
    return result.data;
  }, []);

  useEffect(() => {
    if (!pendingPaymentId) return;

    let cancelled = false;
    let attempts = 0;
    let interval = 0;

    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      attempts += 1;
      if (attempts > 60) {
        window.clearInterval(interval);
        return;
      }

      void readCheckout(pendingPaymentId)
        .then((next) => {
          if (cancelled) return;
          setCheckout(next);
          if (next.status !== 'pending' || checkoutIsExpired(next.expiresAt)) {
            window.clearInterval(interval);
          }
        })
        .catch((error: unknown) => {
          console.error('Could not refresh crypto payment:', error);
        });
    };

    interval = window.setInterval(tick, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pendingPaymentId, readCheckout]);

  useEffect(() => {
    if (checkout?.status === 'paid') {
      setNotice({
        tone: 'success',
        text: 'Payment confirmed. Your subscription is active — check your profile for the expiry date.',
      });
    }
  }, [checkout?.status]);

  const startCheckout = async (plan: Plan) => {
    if (!user) {
      navigate('/auth', { state: { from: '/pricing' } });
      return;
    }
    if (plan.tier === 'free') {
      navigate('/barter');
      return;
    }

    setStartingPlan(plan.tier);
    setNotice(null);
    try {
      const createCheckout = httpsCallable<{ plan: string }, CryptoCheckout>(
        functions,
        'createCryptoCheckout',
      );
      const result = await createCheckout({ plan: plan.tier });
      setCheckout(result.data);
    } catch (error) {
      console.error('Could not create crypto checkout:', error);
      setNotice({ tone: 'error', text: readableError(error) });
    } finally {
      setStartingPlan(null);
    }
  };

  const refreshNow = async () => {
    if (!checkout) return;
    try {
      setCheckout(await readCheckout(checkout.paymentId));
    } catch (error) {
      console.error('Could not refresh checkout:', error);
      setNotice({ tone: 'error', text: readableError(error) });
    }
  };

  const confirmSandbox = async () => {
    if (!checkout) return;
    setConfirming(true);
    try {
      const confirm = httpsCallable<{ paymentId: string }, CryptoCheckout>(
        functions,
        'confirmSandboxPayment',
      );
      const result = await confirm({ paymentId: checkout.paymentId });
      setCheckout(result.data);
    } catch (error) {
      console.error('Could not confirm sandbox payment:', error);
      setNotice({ tone: 'error', text: readableError(error) });
    } finally {
      setConfirming(false);
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2_000);
    } catch {
      setNotice({ tone: 'error', text: 'Could not copy. Select the value manually.' });
    }
  };

  const resendVerification = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      setVerificationNote('Verification email sent. Check your inbox, then refresh this page.');
    } catch (error) {
      console.error('Could not send verification email:', error);
      setNotice({
        tone: 'error',
        text: 'Could not send the verification email. Try again in a few minutes.',
      });
    }
  };

  const expired = checkout ? checkoutIsExpired(checkout.expiresAt) : false;

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <AppNav active="pricing" />

      <main className="flex-1 py-16 px-6">
        <div className="max-w-7xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Choose the plan that fits your trading needs. Prices are in rand; paid plans are
            settled in USDT.
          </p>
        </div>

        {user && !user.emailVerified && (
          <div className="max-w-6xl mx-auto mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="flex-1">
              Verify your email before paying. A verification link was sent when you signed up.
            </span>
            <button
              type="button"
              onClick={() => void resendVerification()}
              className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-medium text-amber-100 hover:bg-amber-400/20"
            >
              Resend verification email
            </button>
          </div>
        )}

        {verificationNote && (
          <div
            role="status"
            className="max-w-6xl mx-auto mb-8 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-200"
          >
            {verificationNote}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className={`max-w-6xl mx-auto mb-8 rounded-2xl border p-4 text-sm flex justify-between gap-4 ${
              notice.tone === 'success'
                ? 'border-green-500/20 bg-green-500/10 text-green-200'
                : notice.tone === 'error'
                  ? 'border-red-500/20 bg-red-500/10 text-red-200'
                  : 'border-blue-500/20 bg-blue-500/10 text-blue-200'
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss message"
              className="opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.tier}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative p-8 rounded-3xl border ${
                plan.popular
                  ? 'border-umnotho bg-dark-900 shadow-[0_0_40px_rgba(250,204,21,0.1)]'
                  : 'border-white/10 bg-dark-900/50'
              } flex flex-col`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-umnotho text-dark-950 text-xs font-bold uppercase tracking-wider rounded-full">
                  Most popular
                </div>
              )}

              <div className="mb-8">
                <h2 className="text-2xl font-display font-bold text-white mb-2">{plan.name}</h2>
                <p className="text-gray-400 text-sm min-h-10">{plan.description}</p>
              </div>

              <div className="mb-8">
                <span className="text-4xl font-display font-bold text-white">{plan.price}</span>
                {plan.period && <span className="text-gray-400">/{plan.period}</span>}
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-gray-300 text-sm">
                    <Check className="w-5 h-5 text-umnotho shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => void startCheckout(plan)}
                disabled={startingPlan === plan.tier}
                className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                  plan.popular
                    ? 'bg-umnotho text-dark-950 hover:bg-umnotho-hover'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'
                }`}
              >
                {startingPlan === plan.tier ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : plan.tier === 'free' ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Wallet className="w-5 h-5" />
                )}
                {plan.buttonLabel}
              </button>
            </motion.div>
          ))}
        </div>
      </main>

      <SiteFooter />

      <AnimatePresence>
        {checkout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="crypto-checkout-title"
              className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-dark-900 p-8 max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setCheckout(null)}
                aria-label="Close crypto checkout"
                className="absolute right-6 top-6 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <p className="text-xs font-semibold uppercase tracking-wider text-umnotho mb-1">
                Crypto checkout
              </p>
              <h2 id="crypto-checkout-title" className="text-2xl font-display font-bold text-white">
                {checkout.planName}
              </h2>
              <p className="text-sm text-gray-400 mt-1 mb-6">
                {checkout.providerLabel || checkout.provider}
                {checkout.providerStatus
                  ? ` · ${checkout.providerStatus.replace(/_/g, ' ')}`
                  : ''}
              </p>

              {checkout.status === 'paid' ? (
                <div>
                  <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-5 text-green-200 mb-5">
                    <p className="font-semibold flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-5 h-5" /> Payment confirmed
                    </p>
                    <p className="text-sm">
                      Your {checkout.planName} plan is active. Check your profile for the expiry
                      date.
                    </p>
                    {checkout.txHash && (
                      <p className="text-xs text-green-300/70 mt-3 break-all">
                        Transaction: {checkout.txHash}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/profile')}
                      className="flex-1 rounded-xl bg-umnotho px-4 py-3 font-semibold text-dark-950 hover:bg-umnotho-hover"
                    >
                      View profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckout(null)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {checkout.sandbox && (
                    <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                      <p className="font-semibold flex items-center gap-2 mb-1">
                        <Info className="w-4 h-4" /> Sandbox mode
                      </p>
                      Do not send real funds. This checkout uses a test address and can only be
                      confirmed by the local Functions emulator.
                    </div>
                  )}

                  <div className="mb-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/5 bg-dark-950 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Price</p>
                      <p className="text-lg font-semibold text-white">
                        {formatZar(checkout.amountZar)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-dark-950 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                        You send
                      </p>
                      <p className="text-lg font-semibold text-umnotho">
                        {formatUsdt(checkout.amountUsdt)}
                      </p>
                    </div>
                    <div className="col-span-2 rounded-xl border border-white/5 bg-dark-950 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                        Locked rate
                      </p>
                      <p className="text-sm text-gray-300">
                        R {checkout.rateZarPerUsdt.toFixed(2)} per USDT · {checkout.network}
                      </p>
                    </div>
                  </div>

                  {checkout.checkoutUrl ? (
                    <a
                      href={checkout.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-umnotho px-4 py-3 font-semibold text-dark-950 hover:bg-umnotho-hover"
                    >
                      Open hosted checkout <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <div className="mb-5 rounded-xl border border-white/5 bg-dark-950 p-4">
                      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                        Send USDT to this address
                      </p>
                      <div className="flex items-start gap-2">
                        <code className="flex-1 break-all text-sm text-gray-200">
                          {checkout.address ?? 'No address was returned by the provider.'}
                        </code>
                        {checkout.address && (
                          <button
                            type="button"
                            onClick={() => void copy(checkout.address ?? '', 'address')}
                            aria-label="Copy payment address"
                            className="rounded-lg border border-white/10 bg-white/5 p-2 text-white hover:bg-white/10"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {copied === 'address' && (
                        <p className="mt-2 text-xs text-green-300">Address copied.</p>
                      )}
                    </div>
                  )}

                  <div className="mb-5 rounded-xl border border-white/5 bg-dark-950 p-4">
                    <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                      Payment reference
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all text-xs text-gray-300">
                        {checkout.reference}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copy(checkout.reference, 'reference')}
                        aria-label="Copy payment reference"
                        className="rounded-lg border border-white/10 bg-white/5 p-2 text-white hover:bg-white/10"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    {copied === 'reference' && (
                      <p className="mt-2 text-xs text-green-300">Reference copied.</p>
                    )}
                  </div>

                  {expired && (
                    <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                      This checkout has expired. Close it and start a new one.
                    </div>
                  )}

                  <div className="space-y-3">
                    {checkout.sandbox && !expired && (
                      <button
                        type="button"
                        onClick={() => void confirmSandbox()}
                        disabled={confirming}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-umnotho px-4 py-3 font-semibold text-dark-950 hover:bg-umnotho-hover disabled:opacity-60"
                      >
                        {confirming ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5" />
                        )}
                        Simulate payment (sandbox)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void refreshNow()}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
                    >
                      I’ve paid — check status
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckout(null)}
                      className="w-full rounded-xl px-4 py-2 text-sm text-gray-400 hover:text-white"
                    >
                      Close
                    </button>
                  </div>

                  <p className="mt-4 text-xs text-gray-500">
                    Keep this window open while we confirm your payment.
                  </p>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
