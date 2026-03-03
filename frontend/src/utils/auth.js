const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const JWT_KEY = 'quorum_jwt';
const USER_KEY = 'quorum_user';

export function getStoredAuth() {
  try {
    const token = localStorage.getItem(JWT_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    if (!token || !user) return null;
    return { token, user };
  } catch {
    return null;
  }
}

function storeAuth(token, user) {
  localStorage.setItem(JWT_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Exchange a Google access token for a Quorum JWT.
 */
async function exchangeGoogleToken(googleAccessToken) {
  const res = await fetch(`${BACKEND_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: googleAccessToken }),
  });
  if (!res.ok) throw new Error('Authentication failed');
  return res.json(); // { token, user: { id, email, tier } }
}

/**
 * Trigger Google sign-in using the GIS token client.
 * Returns { token, user } on success.
 */
export function signInWithGoogle() {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: async (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        try {
          const authData = await exchangeGoogleToken(response.access_token);
          storeAuth(authData.token, authData.user);
          resolve(authData);
        } catch (err) {
          reject(err);
        }
      },
    });

    client.requestAccessToken();
  });
}

export function signOut() {
  clearAuth();
}
