import React from 'react';

function StatusBadge({ status, ratio, threshold }) {
  const isConsensus = status === 'consensus_reached';
  const isBestEffort = status === 'best_effort';

  const bgColor = isConsensus
    ? 'bg-green-100'
    : isBestEffort
    ? 'bg-amber-100'
    : 'bg-gray-100';

  const textColor = isConsensus
    ? 'text-green-700'
    : isBestEffort
    ? 'text-amber-700'
    : 'text-gray-700';

  const label = isConsensus
    ? 'Consensus Reached'
    : isBestEffort
    ? 'Best Effort'
    : 'Processing';

  const ratioPercent = Math.round(ratio * 100);
  const thresholdPercent = Math.round(threshold * 100);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}
      >
        {isConsensus && (
          <svg
            className="w-3.5 h-3.5 mr-1"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {isBestEffort && (
          <svg
            className="w-3.5 h-3.5 mr-1"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {label}
      </span>
      <span className="text-xs text-gray-500">
        {ratioPercent}% agreed (threshold: {thresholdPercent}%)
      </span>
    </div>
  );
}

export default StatusBadge;
