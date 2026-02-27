import React, { useState } from 'react';

function Header({ onSettingsClick, onSidebarClick, auth, onSignOut, onUpgrade }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tier = auth?.user?.tier;
  const email = auth?.user?.email;

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
        {/* Upgrade button for free users */}
        {tier === 'free' && (
          <button
            onClick={onUpgrade}
            className="px-2.5 py-1 text-xs font-medium text-quorum-600 bg-quorum-50 hover:bg-quorum-100 rounded-lg transition-colors"
            title="Upgrade to Pro"
          >
            Upgrade
          </button>
        )}

        {/* Sidebar button */}
        <button
          onClick={onSidebarClick}
          className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          title="Open in sidebar"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l4-3-4-3v6z" />
          </svg>
        </button>

        {/* Settings button */}
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          title="Settings"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* User avatar + menu */}
        {auth && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="w-8 h-8 rounded-full bg-quorum-100 flex items-center justify-center text-sm font-medium text-quorum-700 hover:bg-quorum-200 transition-colors"
              title={email}
            >
              {email?.[0]?.toUpperCase() ?? '?'}
            </button>

            {menuOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                {/* Menu */}
                <div className="absolute right-0 top-10 z-20 w-48 bg-white rounded-xl shadow-bubbly border border-gray-100 py-1 text-sm">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500 truncate">{email}</p>
                    <span className={`text-xs font-medium ${tier === 'paid' ? 'text-quorum-600' : 'text-gray-500'}`}>
                      {tier === 'paid' ? 'Pro' : 'Free tier'}
                    </span>
                  </div>
                  {tier === 'free' && (
                    <button
                      onClick={() => { setMenuOpen(false); onUpgrade(); }}
                      className="w-full text-left px-3 py-2 text-quorum-600 hover:bg-quorum-50 transition-colors"
                    >
                      Upgrade to Pro
                    </button>
                  )}
                  <button
                    onClick={() => { setMenuOpen(false); onSignOut(); }}
                    className="w-full text-left px-3 py-2 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
