/**
 * Google OAuth + Quorum JWT auth utilities for the Chrome extension.
 *
 * Flow:
 * 1. signInWithGoogle() launches chrome.identity.launchWebAuthFlow (implicit flow)
 * 2. Parses the Google access token from the redirect URL fragment
 * 3. Exchanges it with the Quorum backend for a 30-day JWT
 * 4. Stores the JWT + user info in chrome.storage.local
 */

import { HOSTED_CONFIG } from './storage';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const AUTH_STORAGE_KEY = 'quorum_auth';

/**
 * Build the Google OAuth URL for the implicit token flow.
 * The redirect URI is the chromiumapp.org URI Chrome generates for the extension.
 */
function buildGoogleAuthUrl(redirectUri) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: 'openid email profile',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Parse the Google access token out of the redirect URL's hash fragment.
 * Returns null if the token is not present.
 */
function parseAccessToken(redirectUrl) {
  try {
    const hash = new URL(redirectUrl).hash.substring(1); // strip leading #
    const params = new URLSearchParams(hash);
    return params.get('access_token') || null;
  } catch {
    return null;
  }
}

/**
 * Launch Google OAuth flow and return the Google access token.
 * @param {boolean} interactive - Whether to show the OAuth UI (true) or fail silently (false)
 */
function launchOAuthFlow(interactive) {
  return new Promise((resolve, reject) => {
    const extensionId = chrome.runtime.id;
    const redirectUri = `https://${extensionId}.chromiumapp.org/`;
    const authUrl = buildGoogleAuthUrl(redirectUri);

    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive },
      (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!redirectUrl) {
          reject(new Error('OAuth flow was cancelled or returned no URL'));
          return;
        }
        const token = parseAccessToken(redirectUrl);
        if (!token) {
          reject(new Error('No access token in redirect URL'));
          return;
        }
        resolve(token);
      }
    );
  });
}

/**
 * Exchange a Google access token for a Quorum JWT by calling the backend.
 */
async function exchangeGoogleToken(googleAccessToken) {
  const backendUrl = HOSTED_CONFIG.backend_url;
  const response = await fetch(`${backendUrl}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: googleAccessToken }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to authenticate with Quorum');
  }

  return response.json(); // { token, user: { id, email, tier } }
}

/**
 * Persist auth data to chrome.storage.local.
 */
function storeAuth(authData) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [AUTH_STORAGE_KEY]: authData }, resolve);
    } else {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      resolve();
    }
  });
}

/**
 * Read stored auth data from chrome.storage.local.
 * Returns null if not present.
 */
export function getStoredAuth() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(AUTH_STORAGE_KEY, (result) => {
        resolve(result[AUTH_STORAGE_KEY] || null);
      });
    } else {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      resolve(stored ? JSON.parse(stored) : null);
    }
  });
}

/**
 * Clear stored auth data (sign out).
 */
export function signOut() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(AUTH_STORAGE_KEY, resolve);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      resolve();
    }
  });
}

/**
 * Launch the Google OAuth flow interactively, exchange for a Quorum JWT,
 * and persist the result.
 *
 * @returns {{ token: string, user: { id, email, tier } }}
 */
export async function signInWithGoogle() {
  const googleToken = await launchOAuthFlow(true);
  const authData = await exchangeGoogleToken(googleToken);
  await storeAuth(authData);
  return authData;
}

/**
 * Check if the stored JWT is expired.
 * JWT payload is base64-encoded; we decode it to read the `exp` claim.
 */
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000; // convert seconds to ms
    return Date.now() >= expiresAt - 60_000; // 1-minute buffer
  } catch {
    return true;
  }
}

/**
 * Return stored auth if valid, attempt silent re-auth if token is expired.
 * Returns null if no auth exists or silent re-auth fails.
 */
export async function refreshAuthIfNeeded() {
  const stored = await getStoredAuth();
  if (!stored) return null;

  if (!isTokenExpired(stored.token)) return stored;

  // Token is expired — try to silently re-authenticate
  try {
    const googleToken = await launchOAuthFlow(false); // non-interactive
    const authData = await exchangeGoogleToken(googleToken);
    await storeAuth(authData);
    return authData;
  } catch {
    // Silent auth failed (user not signed into Chrome, etc.) — clear and return null
    await signOut();
    return null;
  }
}
