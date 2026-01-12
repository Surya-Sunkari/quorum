/**
 * API client for communicating with the Quorum backend.
 */

/**
 * Send a question to the backend.
 * @param {string} backendUrl - Backend URL
 * @param {object} params - Request parameters
 * @returns {Promise<object>} Response from backend
 */
export async function askQuestion(backendUrl, params) {
  const response = await fetch(`${backendUrl}/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    const error = new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
    // Attach detailed error info for debugging
    error.details = errorData;
    throw error;
  }

  return response.json();
}

/**
 * Validate an API key with the backend.
 * @param {string} backendUrl - Backend URL
 * @param {string} apiKey - API key to validate
 * @param {string} provider - Provider name (openai, anthropic, gemini)
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateApiKey(backendUrl, apiKey, provider) {
  try {
    const response = await fetch(`${backendUrl}/validate-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ api_key: apiKey, provider }),
    });

    return response.json();
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Check if the backend is reachable.
 * @param {string} backendUrl - Backend URL
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth(backendUrl) {
  try {
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
    });
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}
