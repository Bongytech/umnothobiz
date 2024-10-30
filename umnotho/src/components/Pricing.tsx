// src/components/Pricing.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/Umnotho2.png';
import GooglePayButton from '@google-pay/button-react';
import '../App.css';
import { auth, db } from '../firebaseConfig';
import {  doc, updateDoc } from 'firebase/firestore';
//import { loadGooglePay } from '@google-pay/google-pay-js';


type SubscriptionType = 'none' | 'basic' | 'biz';
type Plan = {
  name: string;
  description: string;
  price: string;
  priceAmount: string;
  features: string[];
  buttonLabel: string;
  subscriptionType: SubscriptionType;
};
const Pricing: React.FC = () => {
 
  const navigate = useNavigate();
  //const handlePricing = () => navigate('/pricing');
  const handleLogin = () => navigate('/auth');
  const handleLogoClick = () => navigate('/');

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
      price: "49 ZAR/month",
      priceAmount: "49.00",
      features: [
        "Unlimited transactions on individual bids",
        "Business bids available with transaction fee",
      ],
      buttonLabel: "Subscribe",
      subscriptionType: 'basic',
    },
    {
      name: "Biz",
      description: "Unlimited transactions on all bids.",
      price: "97 ZAR/month",
      priceAmount: "97.00",
      features: [
        "Unlimited transactions on individual and business bids",
        "Priority support",
      ],
      buttonLabel: "Upgrade",
      subscriptionType: 'biz',
    },
  ];

  // Update the user's subscription type in Firestore
  const updateSubscription = async (subscriptionType: SubscriptionType) => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, { subscriptionType });
    alert(`Subscription updated to ${subscriptionType}`);
  };
    // Handle payment or authentication if needed
  const handlePaymentOrAuth = async (subscriptionType: SubscriptionType) => {
   if (!auth.currentUser) {
      alert("Please log in to continue with the payment.");
      navigate('/auth');
      return;
    }
    if (subscriptionType === 'none') {
      alert("Please log in to continue with the payment.");
      navigate('/auth');
      return;
    } else if(subscriptionType === 'basic'|| subscriptionType === 'biz'){navigate('/auth');} 

  

  }
   /* const paymentDataRequest = {
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
        merchantId: 'your-merchant-id',
        merchantName: 'Example Merchant',
      },
      transactionInfo: {
        totalPriceStatus: 'FINAL',
        totalPriceLabel: 'Total',
        totalPrice: priceAmount,
        currencyCode: 'USD',
        countryCode: 'US',
      },
    };

    googlePayClient.loadPaymentData(paymentDataRequest).then(() => {
      updateSubscription(subscriptionType);
    }).catch((error: any) => {
      console.error("Google Pay error:", error);
      alert("Payment failed. Please try again.");
    });
  };*/


  return (
   <div><nav className="navbar">
        <div className="nav-logo" onClick={handleLogoClick}>
          <img src={logo} alt="Umnotho Logo" style={{ cursor: 'pointer', height: '40px' }} />
        </div>
        <div className="nav-buttons">
        <button className="nav-button" onClick={handleLogin}>Login</button>
        </div>
      </nav> <div style={styles.container}>
      <h1 style={styles.heading}>Our Pricing Plans</h1>
      <div style={styles.plansContainer}>
          
      <div className="plans">
        {plans.map((plan, index) => (
          <div key={index} className="plan-card">
            <h3>{plan.name}</h3>
            <p className="plan-price">{plan.price}</p>
            <p className="plan-description">{plan.description}</p>
            <ul className="plan-features">
              {plan.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
            {plan.subscriptionType === 'none' ? (
              <button
                className="plan-button"
                onClick={() => updateSubscription(plan.subscriptionType)}
              >
                {plan.buttonLabel}
              </button>
            ) : (
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
                    merchantId: 'your-merchant-id',
                    merchantName: 'Example Merchant',
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
              />
            )}
          </div>
        ))}
      </div>
    </div></div></div>
  );
};

// Responsive inline styling
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    alignItems: 'center',
    padding: '20px',
    color: '#ffd700',
  },
  heading: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '20px',
    textAlign: 'center' as 'center',
  },
  plansContainer: {
    display: 'flex',
    flexDirection: 'row' as 'row',
    gap: '20px',
    justifyContent: 'center',
    marginTop: '20px',
    flexWrap: 'wrap' as 'wrap',
	
  },
  plan: {
    width: '100%',
    maxWidth: '300px',
    padding: '20px',
    borderRadius: '8px',
    backgroundColor: '#1f1f1f',
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)',
    textAlign: 'left' as 'center',
    marginBottom: '20px',
  },
  planTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  price: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#ffd700',
    marginBottom: '15px',
  },
  features: {
    listStyleType: 'none' as 'none',
    padding: 0,
    fontSize: '0.9rem',
    lineHeight: '1.6',
    marginBottom: '20px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#ffd700',
    backgroundColor: '#090f0f',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
};
  
export default Pricing;
