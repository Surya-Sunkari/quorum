const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getUserInfo(token) {
  const res = await fetch(`${BACKEND_URL}/auth/me`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load user info');
  return res.json();
}

export async function createCheckoutSession(token, plan) {
  const res = await fetch(`${BACKEND_URL}/billing/create-checkout`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create checkout session');
  }
  return res.json(); // { checkout_url }
}
