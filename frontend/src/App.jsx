import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Pricing from './pages/Pricing';
import Success from './pages/Success';
import Cancel from './pages/Cancel';
import { getStoredAuth, signInWithGoogle, signOut } from './utils/auth';

function App() {
  const [auth, setAuth] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) setAuth(stored);
  }, []);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      const authData = await signInWithGoogle();
      setAuth(authData);
    } catch {
      // user dismissed or error — silent
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    setAuth(null);
  };

  const handleAuthChange = (authData) => {
    setAuth(authData);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar
          auth={auth}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          signingIn={signingIn}
        />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pricing" element={<Pricing auth={auth} onAuthChange={handleAuthChange} />} />
            <Route path="/success" element={<Success />} />
            <Route path="/cancel" element={<Cancel />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
