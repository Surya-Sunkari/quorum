import React from 'react';

function LoadingState({ message }) {
  // Parse the number of agents from message like "Running 3 agents..." or "Running 1 agent..."
  const agentMatch = message?.match(/(\d+)\s*agents?/i);
  const numAgents = agentMatch ? parseInt(agentMatch[1], 10) : 3;

  return (
    <div className="bg-white rounded-2xl shadow-bubbly overflow-hidden">
      {/* Header with shimmer effect */}
      <div className="px-4 py-3 bg-gradient-to-r from-quorum-50 via-white to-quorum-50 border-b border-gray-100 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-quorum-400 animate-pulse"></div>
          <span className="text-sm font-medium text-quorum-600">Processing</span>
        </div>
      </div>

      {/* Main content */}
      <div className="p-5">
        {/* Agent visualization */}
        <div className="flex justify-center items-center gap-3 mb-4">
          {[...Array(numAgents)].map((_, i) => (
            <div
              key={i}
              className="relative"
              style={{ animationDelay: `${i * 200}ms` }}
            >
              {/* Outer ring */}
              <div
                className="w-10 h-10 rounded-full border-2 border-quorum-200 flex items-center justify-center animate-pulse"
                style={{ animationDelay: `${i * 150}ms`, animationDuration: '1.5s' }}
              >
                {/* Inner circle */}
                <div
                  className="w-5 h-5 rounded-full bg-gradient-to-br from-quorum-400 to-quorum-500 animate-agent-think"
                  style={{ animationDelay: `${i * 200}ms` }}
                ></div>
              </div>
              {/* Agent label */}
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-medium">
                {i + 1}
              </span>
            </div>
          ))}
        </div>

        {/* Loading message */}
        <p className="text-center text-sm text-gray-700 font-medium mt-6 mb-1">
          {message}
        </p>

        {/* Progress bar */}
        <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-quorum-400 to-quorum-500 rounded-full animate-progress"></div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Agents are thinking independently...
        </p>
      </div>
    </div>
  );
}

export default LoadingState;
