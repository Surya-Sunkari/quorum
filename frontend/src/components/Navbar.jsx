import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navbar({ auth, onSignIn, onSignOut }) {
  const location = useLocation();

  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-lg font-bold tracking-tight select-none">
          <span className="text-gray-800">Quo</span>
          <span className="text-quorum-500">rum</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <Link
            to="/pricing"
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              location.pathname === '/pricing'
                ? 'text-quorum-600 bg-quorum-50'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            Pricing
          </Link>

          {auth ? (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-gray-400">{auth.user?.email}</span>
              <button
                onClick={onSignOut}
                className="px-3 py-1.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="ml-2 px-3 py-1.5 rounded-xl text-sm font-medium text-quorum-600 bg-quorum-50 hover:bg-quorum-100 transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
