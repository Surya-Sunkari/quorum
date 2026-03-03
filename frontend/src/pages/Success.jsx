import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUserInfo } from '../utils/api';
import { getStoredAuth } from '../utils/auth';

const TIER_LABELS = {
  standard: 'Standard',
  pro: 'Pro',
};

function Success() {
  const [tier, setTier] = useState(null);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth?.token) {
      setPolling(false);
      return;
    }

    let attempts = 0;
    const MAX_ATTEMPTS = 40; // ~2 minutes at 3s intervals

    const interval = setInterval(async () => {
      attempts++;
      try {
        const info = await getUserInfo(auth.token);
        if (info.tier === 'standard' || info.tier === 'pro') {
          setTier(info.tier);
          setPolling(false);
          clearInterval(interval);
        }
      } catch {
        // ignore transient errors
      }

      if (attempts >= MAX_ATTEMPTS) {
        setPolling(false);
        clearInterval(interval);
      }
    }, 3000);

    // Also check immediately
    getUserInfo(auth.token)
      .then((info) => {
        if (info.tier === 'standard' || info.tier === 'pro') {
          setTier(info.tier);
          setPolling(false);
          clearInterval(interval);
        }
      })
      .catch(() => {});

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      {polling ? (
        <div className="bg-white rounded-2xl shadow-bubbly p-10 max-w-sm w-full space-y-5">
          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-quorum-200 border-t-quorum-500 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Confirming your upgrade…</p>
            <p className="text-xs text-gray-400 mt-1">This usually takes a few seconds.</p>
          </div>
        </div>
      ) : tier ? (
        <div className="bg-white rounded-2xl shadow-bubbly p-10 max-w-sm w-full space-y-5">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-quorum-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-quorum-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-base font-semibold text-gray-800">You're on {TIER_LABELS[tier]}</p>
            <p className="text-sm text-gray-500 mt-1">Your plan is active. Open the extension to keep going.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              to="/"
              className="w-full py-2.5 rounded-xl text-sm font-medium text-center bg-quorum-500 text-white hover:bg-quorum-600 shadow-bubbly transition-all"
            >
              Back to home
            </Link>
            <Link
              to="/pricing"
              className="w-full py-2.5 rounded-xl text-sm font-medium text-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all"
            >
              View plans
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-bubbly p-10 max-w-sm w-full space-y-5">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-quorum-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-quorum-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-base font-semibold text-gray-800">Payment received</p>
            <p className="text-sm text-gray-500 mt-1">
              Your account will update shortly. If the extension still shows your old plan, sign out and back in.
            </p>
          </div>
          <Link
            to="/"
            className="block w-full py-2.5 rounded-xl text-sm font-medium text-center bg-quorum-500 text-white hover:bg-quorum-600 shadow-bubbly transition-all"
          >
            Back to home
          </Link>
        </div>
      )}
    </div>
  );
}

export default Success;
