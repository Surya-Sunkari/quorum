import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import MathText from './MathText';

function AnswerCard({ result, showDetails }) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const {
    status,
    answer,
    agreement_ratio_achieved,
    agreement_threshold,
    winning_cluster_size,
    n_agents,
    rounds_used,
    confidence,
    disagreement_summary,
    agent_outputs = [],
  } = result;

  return (
    <div className="bg-white rounded-2xl shadow-bubbly overflow-hidden">
      {/* Status header */}
      <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <StatusBadge
          status={status}
          ratio={agreement_ratio_achieved}
          threshold={agreement_threshold}
        />
      </div>

      {/* Answer content */}
      <div className="p-4">
        <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
          <MathText text={answer} />
          {/* {answer} */}
        </div>
      </div>

      {/* Meta info */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span>
            <span className="font-medium text-gray-600">{winning_cluster_size}</span>
            /{n_agents} agents agreed
          </span>
          <span>
            <span className="font-medium text-gray-600">{rounds_used}</span>
            {rounds_used === 1 ? ' round' : ' rounds'}
          </span>
          {confidence > 0 && (
            <span>
              Confidence:{' '}
              <span className="font-medium text-gray-600">
                {Math.round(confidence * 100)}%
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Details disclosure */}
      {showDetails && (agent_outputs.length > 0 || disagreement_summary) && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span>Show details</span>
            <svg
              className={`w-4 h-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {detailsOpen && (
            <div className="px-4 pb-4 space-y-4">
              {/* Disagreement summary */}
              {disagreement_summary && (
                <div className="bg-amber-50 rounded-xl p-3">
                  <h4 className="text-xs font-medium text-amber-700 mb-1">
                    Disagreement Summary
                  </h4>
                  <p className="text-xs text-amber-600">{disagreement_summary}</p>
                </div>
              )}

              {/* Agent outputs */}
              {agent_outputs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-600">
                    Agent Responses
                  </h4>
                  {agent_outputs.map((output, index) => (
                    <div
                      key={output.agent_id ?? index}
                      className="bg-gray-50 rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">
                          Agent {output.agent_id + 1}
                        </span>
                        <span className="text-xs text-gray-400">
                          {Math.round(output.confidence * 100)}% confident
                        </span>
                      </div>
                      <div className="text-xs text-gray-700 mb-2">
                        <MathText text={output.answer} />
                      </div>
                      {output.short_rationale && (
                        <div className="text-xs text-gray-500 italic">
                          <MathText text={output.short_rationale} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AnswerCard;
