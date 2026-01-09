import React from 'react';

function QuestionInput({ value, onChange, onSubmit, onKeyDown, disabled }) {
  return (
    <div className="bg-white rounded-2xl shadow-bubbly p-4">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask a question..."
        disabled={disabled}
        rows={3}
        className="w-full resize-none border-0 bg-transparent text-gray-800 placeholder-gray-400 focus:ring-0 focus:outline-none text-sm leading-relaxed"
      />
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          Ctrl+Enter to submit
        </span>
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium rounded-xl shadow-bubbly hover:shadow-bubbly-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          {disabled ? 'Asking...' : 'Ask'}
        </button>
      </div>
    </div>
  );
}

export default QuestionInput;
