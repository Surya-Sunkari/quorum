import React, { useState } from 'react';

function ErrorMessage({ message, details, onDismiss }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-red-50 rounded-2xl shadow-bubbly p-4 border border-red-100">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            className="w-5 h-5 text-red-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-red-700">{message}</p>
          {details && (
            <>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-red-500 hover:text-red-700 mt-1 underline"
              >
                {showDetails ? 'Hide details' : 'Show details'}
              </button>
              {showDetails && (
                <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded-lg overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                  {typeof details === 'string' ? details : JSON.stringify(details, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-red-400 hover:text-red-600"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ErrorMessage;
