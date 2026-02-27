import React from 'react';

/**
 * Shows current monthly usage for free-tier users.
 * Props: { count: number, limit: number }
 */
function UsageDisplay({ count, limit }) {
  if (limit === null || limit === undefined) return null;

  const percent = Math.min(100, Math.round((count / limit) * 100));
  const isNearLimit = percent >= 80;
  const isAtLimit = count >= limit;

  return (
    <div className="px-4 py-2 bg-white border-b border-gray-100">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">
          {isAtLimit ? 'Monthly limit reached' : `${count} / ${limit} uses this month`}
        </span>
        <span className={`text-xs font-medium ${isAtLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-gray-400'}`}>
          {percent}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isAtLimit ? 'bg-red-400' : isNearLimit ? 'bg-amber-400' : 'bg-quorum-400'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default UsageDisplay;
