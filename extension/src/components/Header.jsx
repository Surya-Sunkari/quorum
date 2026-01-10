import React from 'react';

function Header({ onSettingsClick, onSidebarClick }) {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
      <div className="flex items-center gap-2">
        <img src="/quorum_logo_no_text.png" alt="Quorum" className="w-10 h-10 object-contain" />
        <h1 className="text-xl font-bold tracking-tight">
          <span className="text-gray-800">Quo</span>
          <span className="text-quorum-500">rum</span>
        </h1>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onSidebarClick}
          className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          title="Open in sidebar"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h7"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 15l4-3-4-3v6z"
            />
          </svg>
        </button>
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          title="Settings"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default Header;
