import React, { useState } from 'react';
import GoogleButton from '../components/GoogleButton';
import { signInWithGoogle } from '../utils/auth';
import { createCheckoutSession } from '../utils/api';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '',
    uses: '20 uses / month',
    models: '3 models',
    modelList: 'GPT-4.1 Mini · Claude Haiku · Gemini Flash',
    cta: null,
    highlight: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$5',
    period: '/mo',
    uses: '200 uses / month',
    models: 'Mid-tier models',
    modelList: 'GPT-4.1 · Claude Sonnet · Gemini Flash',
    cta: 'Get Standard',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$15',
    period: '/mo',
    uses: '500 uses / month',
    models: 'All models',
    modelList: 'GPT-5.2 · Claude Opus · Gemini Pro · and more',
    cta: 'Get Pro',
    highlight: true,
  },
];

function Pricing({ auth, onAuthChange }) {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async (plan) => {
    setSigningIn(true);
    setError(null);
    setPendingPlan(plan);
    try {
      const authData = await signInWithGoogle();
      onAuthChange(authData);
      // Proceed directly to checkout with the new token
      await initiateCheckout(plan, authData.token);
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setSigningIn(false);
      setPendingPlan(null);
    }
  };

  const initiateCheckout = async (plan, token) => {
    setLoadingPlan(plan);
    setError(null);
    try {
      const { checkout_url } = await createCheckoutSession(token, plan);
      window.location.href = checkout_url;
    } catch (err) {
      setError(err.message || 'Could not start checkout. Please try again.');
      setLoadingPlan(null);
    }
  };

  const handleSelectPlan = async (planId) => {
    if (!auth) {
      await handleGoogleSignIn(planId);
      return;
    }

    if (auth.user?.tier !== 'free' && planId === 'standard') {
      return; // Already on standard or higher
    }

    await initiateCheckout(planId, auth.token);
  };

  const userTier = auth?.user?.tier;

  return (
    <div className="max-w-5xl mx-auto w-full px-6 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Simple pricing</h1>
        <p className="mt-3 text-gray-500 text-sm">Start free. Upgrade when you need more reach or models.</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const isCurrent = userTier === plan.id;
          const isBlocked = plan.id === 'standard' && userTier === 'pro';
          const isPlanLoading = loadingPlan === plan.id || (signingIn && pendingPlan === plan.id);

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl p-6 flex flex-col gap-5 ${
                plan.highlight ? 'shadow-bubbly-lg ring-1 ring-quorum-200' : 'shadow-bubbly'
              }`}
            >
              {/* Plan name + price */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    {plan.name}
                  </span>
                  {plan.highlight && (
                    <span className="text-xs text-quorum-600 bg-quorum-50 px-2 py-0.5 rounded-full font-medium">
                      Most popular
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  {plan.period && (
                    <span className="text-sm text-gray-400">{plan.period}</span>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-quorum-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {plan.uses}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-quorum-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {plan.models}
                </div>
                <p className="text-xs text-gray-400 mt-1 pl-6">{plan.modelList}</p>
              </div>

              {/* CTA */}
              {plan.cta && !isCurrent && !isBlocked ? (
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={!!loadingPlan || signingIn}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                    plan.highlight
                      ? 'bg-quorum-500 text-white hover:bg-quorum-600 shadow-bubbly'
                      : 'bg-quorum-50 text-quorum-700 hover:bg-quorum-100'
                  }`}
                >
                  {isPlanLoading
                    ? 'Loading…'
                    : !auth
                    ? `Sign in to ${plan.cta.toLowerCase()}`
                    : plan.cta}
                </button>
              ) : isCurrent ? (
                <div className="w-full py-2.5 rounded-xl text-sm text-center text-gray-400 bg-gray-50">
                  Your current plan
                </div>
              ) : plan.id === 'free' ? (
                <div className="w-full py-2.5 rounded-xl text-sm text-center text-gray-400 bg-gray-50">
                  Always free
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Sign-in note for unauthenticated users */}
      {!auth && (
        <div className="mt-8 flex justify-center">
          <div className="bg-white rounded-xl shadow-bubbly p-4 flex items-center gap-4">
            <p className="text-sm text-gray-500">Already have an account?</p>
            <GoogleButton
              onClick={() => handleGoogleSignIn(null)}
              loading={signingIn && !pendingPlan}
              label="Sign in"
            />
          </div>
        </div>
      )}

      {error && (
        <p className="mt-6 text-center text-sm text-red-500">{error}</p>
      )}

      {/* Footer note */}
      <p className="mt-10 text-center text-xs text-gray-400">
        Payments handled by Stripe. Cancel anytime from your billing portal.
      </p>
    </div>
  );
}

export default Pricing;
