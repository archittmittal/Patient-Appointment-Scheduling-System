import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Activity, ShieldCheck, AlertCircle } from 'lucide-react';

const CheckoutForm = ({ amount, onPaymentSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      return;
    }

    setIsLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // We handle success locally instead of redirecting
    });

    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setMessage(error.message);
      } else {
        setMessage('An unexpected error occurred.');
      }
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onPaymentSuccess();
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-6">
        <PaymentElement id="payment-element" />
      </div>
      
      {message && (
        <div className="p-4 mb-6 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 items-start">
          <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-rose-800 leading-relaxed font-medium">
            {message}
          </p>
        </div>
      )}

      <button
        disabled={isLoading || !stripe || !elements}
        id="submit"
        className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2 relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300"></div>
        {isLoading ? <Activity size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
        <span id="button-text">
          {isLoading ? 'Processing...' : `Pay ₹${Number(amount).toLocaleString('en-IN')}`}
        </span>
      </button>
      
      <p className="text-center text-[10px] text-slate-400 mt-4 px-4 leading-relaxed flex items-center justify-center gap-2">
        <ShieldCheck size={12} className="text-emerald-500" />
        Secured by Stripe Test Mode
      </p>
    </form>
  );
};

export default CheckoutForm;
