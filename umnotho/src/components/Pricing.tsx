import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, Info } from 'lucide-react';
import AppNav from './AppNav';
import { useAuth } from '../contexts/AuthContext';

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
    buttonLabel: 'Choose Basic',
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
    buttonLabel: 'Choose Biz',
    tier: 'biz',
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notice, setNotice] = useState('');

  const handlePlanClick = (plan: Plan) => {
    if (plan.tier === 'free') {
      navigate(user ? '/barter' : '/auth');
      return;
    }

    setNotice(
      'Payments are not connected in this demo. The paid tiers are shown for the product design, and no card details are collected.',
    );
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <AppNav active="pricing" />

      <main className="flex-1 py-16 px-6">
        <div className="max-w-7xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Choose the plan that fits your trading needs. No hidden fees.
          </p>
        </div>

        <div className="max-w-6xl mx-auto mb-8 rounded-2xl border border-umnotho/20 bg-umnotho/5 p-4 text-sm text-umnotho flex items-start gap-3">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <p>
            <strong>Demo mode:</strong> checkout is not enabled. Paid plans cannot be purchased and
            no payment details are collected. This page documents the intended pricing model.
          </p>
        </div>

        {notice && (
          <div
            role="status"
            className="max-w-6xl mx-auto mb-8 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-200 flex justify-between gap-4"
          >
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice('')}
              className="text-blue-300 hover:text-white"
            >
              Dismiss
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
                onClick={() => handlePlanClick(plan)}
                className={`w-full py-3 rounded-xl font-semibold transition-all ${
                  plan.popular
                    ? 'bg-umnotho text-dark-950 hover:bg-umnotho-hover'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'
                }`}
              >
                {plan.buttonLabel}
              </button>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
