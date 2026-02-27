/**
 * API client for communicating with the Quorum backend.
 */

function authHeaders(authToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * Send a question to the backend.
 * @param {string} backendUrl - Backend URL
 * @param {object} params - Request parameters
 * @param {string} authToken - JWT auth token
 * @returns {Promise<object>} Response from backend
 */
export async function askQuestion(backendUrl, params, authToken) {
  const response = await fetch(`${backendUrl}/ask`, {
    method: 'POST',
    headers: authHeaders(authToken),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const error = new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
    error.details = errorData;
    error.status = response.status;
    throw error;
  }

  return response.json();
}

/**
 * Get the current user's profile and usage info.
 * @param {string} backendUrl - Backend URL
 * @param {string} authToken - JWT auth token
 * @returns {Promise<{email, tier, usage: {count, limit, period}}>}
 */
export async function getUserInfo(backendUrl, authToken) {
  const response = await fetch(`${backendUrl}/auth/me`, {
    method: 'GET',
    headers: authHeaders(authToken),
  });

  if (!response.ok) {
    throw new Error('Failed to load user info');
  }

  return response.json();
}

/**
 * Create a Stripe Checkout session for upgrading to paid tier.
 * @param {string} backendUrl - Backend URL
 * @param {string} authToken - JWT auth token
 * @returns {Promise<{checkout_url: string}>}
 */
export async function createCheckoutSession(backendUrl, authToken) {
  const response = await fetch(`${backendUrl}/billing/create-checkout`, {
    method: 'POST',
    headers: authHeaders(authToken),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create checkout session');
  }

  return response.json();
}

/**
 * Check if the backend is reachable.
 * @param {string} backendUrl - Backend URL
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth(backendUrl) {
  try {
    const response = await fetch(`${backendUrl}/health`, { method: 'GET' });
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}
