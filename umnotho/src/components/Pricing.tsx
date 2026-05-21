import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import GooglePayButton from '@google-pay/button-react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';

type SubscriptionType = 'none' | 'basic' | 'biz';
type Plan = {
  name: string;
  description: string;
  price: string;
  priceAmount: string;
  features: string[];
  buttonLabel: string;
  subscriptionType: SubscriptionType;
  popular?: boolean;
};

const Pricing: React.FC = () => {
  const navigate = useNavigate();

  const plans: Plan[] = [
    {
      name: "Freemium",
      description: "Access public bids, pay per transaction.",
      price: "Free",
      priceAmount: "0.00",
      features: ["Access to public bids", "Pay-per-transaction"],
      buttonLabel: "Get Started",
      subscriptionType: 'none',
    },
    {
      name: "Basic",
      description: "Monthly subscription with unlimited transactions on individual bids.",
      price: "49 ZAR/mo",
      priceAmount: "49.00",
      features: [
        "Unlimited transactions on individual bids",
        "Business bids available with transaction fee",
      ],
      buttonLabel: "Subscribe",
      subscriptionType: 'basic',
      popular: true,
    },
    {
      name: "Biz",
      description: "Unlimited transactions on all bids.",
      price: "97 ZAR/mo",
      priceAmount: "97.00",
      features: [
        "Unlimited transactions on individual and business bids",
        "Priority support",
      ],
      buttonLabel: "Upgrade",
      subscriptionType: 'biz',
    },
  ];

  const updateSubscription = async (subscriptionType: SubscriptionType) => {
    if (!auth.currentUser) {
      navigate('/auth');
      return;
    }
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, { subscriptionType });
      alert(`Subscription updated to ${subscriptionType}`);
    } catch (error) {
      console.error("Error updating subscription:", error);
    }
  };

  const handlePaymentOrAuth = async (subscriptionType: SubscriptionType) => {
    if (!auth.currentUser) {
      alert("Please log in to continue with the payment.");
      navigate('/auth');
      return;
    }
    if (subscriptionType === 'none') {
      navigate('/auth');
      return;
    } else {
      // In a real app, this would trigger after successful payment
      updateSubscription(subscriptionType);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <nav className="h-20 flex justify-between items-center px-6 md:px-12 border-b border-white/5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-full bg-umnotho flex items-center justify-center text-dark-950 font-bold text-xl">U</div>
          <span className="text-xl font-display font-bold text-white tracking-tight">Umnotho</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/auth')}
            className="text-sm font-medium px-5 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-white"
          >
            Log in
          </button>
        </div>
      </nav>

      <main className="flex-1 py-20 px-6">
        <div className="max-w-7xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">Simple, transparent pricing</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Choose the plan that fits your trading needs. No hidden fees.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative p-8 rounded-3xl border ${plan.popular ? 'border-umnotho bg-dark-900 shadow-[0_0_40px_rgba(250,204,21,0.1)]' : 'border-white/10 bg-dark-900/50'} flex flex-col`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-umnotho text-dark-950 text-xs font-bold uppercase tracking-wider rounded-full">
                  Most Popular
                </div>
              )}
              <div className="mb-8">
                <h3 className="text-2xl font-display font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm h-10">{plan.description}</p>
              </div>
              <div className="mb-8">
                <span className="text-4xl font-display font-bold text-white">{plan.price.split('/')[0]}</span>
                {plan.price.includes('/') && <span className="text-gray-400">/{plan.price.split('/')[1]}</span>}
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-gray-300 text-sm">
                    <Check className="w-5 h-5 text-umnotho shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <div className="mt-auto">
                {plan.subscriptionType === 'none' ? (
                  <button
                    onClick={() => updateSubscription(plan.subscriptionType)}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition-all"
                  >
                    {plan.buttonLabel}
                  </button>
                ) : (
                  <div className="w-full flex justify-center">
                    <GooglePayButton
                      environment="TEST"
                      paymentRequest={{
                        apiVersion: 2,
                        apiVersionMinor: 0,
                        allowedPaymentMethods: [
                          {
                            type: 'CARD',
                            parameters: {
                              allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
                              allowedCardNetworks: ['MASTERCARD', 'VISA'],
                            },
                            tokenizationSpecification: {
                              type: 'PAYMENT_GATEWAY',
                              parameters: {
                                gateway: 'example',
                                gatewayMerchantId: 'exampleMerchantId',
                              },
                            },
                          },
                        ],
                        merchantInfo: {
                          merchantId: '12345678901234567890',
                          merchantName: 'Umnotho',
                        },
                        transactionInfo: {
                          totalPriceStatus: 'FINAL',
                          totalPriceLabel: 'Total',
                          totalPrice: plan.priceAmount,
                          currencyCode: 'ZAR',
                          countryCode: 'ZA',
                        },
                      }}
                      onLoadPaymentData={() => handlePaymentOrAuth(plan.subscriptionType)}
                      buttonType="subscribe"
                      buttonSizeMode="fill"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Pricing;
