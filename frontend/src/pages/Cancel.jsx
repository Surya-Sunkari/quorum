import React from 'react';
import { Link } from 'react-router-dom';

function Cancel() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="bg-white rounded-2xl shadow-bubbly p-10 max-w-sm w-full space-y-5">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        <div>
          <p className="text-base font-semibold text-gray-800">No worries</p>
          <p className="text-sm text-gray-500 mt-1">
            Your payment was cancelled. You can upgrade whenever you're ready.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            to="/pricing"
            className="w-full py-2.5 rounded-xl text-sm font-medium text-center bg-quorum-500 text-white hover:bg-quorum-600 shadow-bubbly transition-all"
          >
            View plans
          </Link>
          <Link
            to="/"
            className="w-full py-2.5 rounded-xl text-sm font-medium text-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Cancel;
