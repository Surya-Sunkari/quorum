import React from 'react';

function LoadingState({ message }) {
  return (
    <div className="bg-white rounded-2xl shadow-bubbly p-6">
      <div className="flex flex-col items-center justify-center space-y-4">
        {/* Animated dots */}
        <div className="flex space-x-2">
          <div
            className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          ></div>
          <div
            className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          ></div>
          <div
            className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          ></div>
        </div>

        {/* Loading message */}
        <p className="text-sm text-gray-600 font-medium">{message}</p>

        {/* Progress hint */}
        <p className="text-xs text-gray-400">
          This may take a few moments...
        </p>
      </div>
    </div>
  );
}

export default LoadingState;
