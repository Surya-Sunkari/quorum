/**
 * Storage utilities for Chrome extension settings.
 * Uses chrome.storage.local for persistence.
 */

// Hosted backend configuration (from environment or defaults)
const HOSTED_CONFIG = {
  backend_url: import.meta.env.VITE_HOSTED_BACKEND_URL || 'http://localhost:5000',
  api_keys: {
    openai: import.meta.env.VITE_HOSTED_OPENAI_API_KEY || '',
    anthropic: import.meta.env.VITE_HOSTED_ANTHROPIC_API_KEY || '',
    gemini: import.meta.env.VITE_HOSTED_GEMINI_API_KEY || '',
  },
};

/**
 * Available models organized by provider.
 */
export const AVAILABLE_MODELS = {
  openai: [
    { id: 'openai:gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Fast' },
    { id: 'openai:gpt-4.1', name: 'GPT-4.1', description: 'Balanced' },
    { id: 'openai:gpt-5-mini', name: 'GPT-5 Mini', description: 'Fast, capable' },
    { id: 'openai:gpt-5.1', name: 'GPT-5.1', description: 'High capability' },
    { id: 'openai:gpt-5.2', name: 'GPT-5.2', description: 'Latest' },
  ],
  anthropic: [
    { id: 'anthropic:claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fast' },
    { id: 'anthropic:claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Balanced' },
    { id: 'anthropic:claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Most capable' },
  ],
  gemini: [
    { id: 'gemini:gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast' },
    { id: 'gemini:gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Fast, capable' },
    { id: 'gemini:gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Most capable' },
  ],
};

/**
 * Get the provider name from a model string.
 * @param {string} model - Model string in format "provider:model-name"
 * @returns {string} Provider name (openai, anthropic, gemini)
 */
export function getProviderFromModel(model) {
  if (model.startsWith('openai:')) return 'openai';
  if (model.startsWith('anthropic:')) return 'anthropic';
  if (model.startsWith('gemini:')) return 'gemini';
  return 'openai'; // Default fallback
}

/**
 * Get the appropriate API key for a model from hosted config.
 * @param {string} model - Model string in format "provider:model-name"
 * @returns {string} API key for the provider
 */
export function getHostedApiKey(model) {
  const provider = getProviderFromModel(model);
  return HOSTED_CONFIG.api_keys[provider] || '';
}

const DEFAULT_SETTINGS = {
  n_agents: 3,
  agreement_ratio: 0.67,
  max_rounds: 2,
  model: 'openai:gpt-4.1-mini',
  // Provider-specific API keys
  openai_api_key: '',
  anthropic_api_key: '',
  gemini_api_key: '',
  return_agent_outputs: false,
  debug_mode: false,
  backend_url: 'http://localhost:5000',
  use_hosted_backend: true, // Default to hosted mode for regular users
  // Mixed-model mode settings
  mixed_mode: false,
  mixed_model_configs: {}, // { 'openai:gpt-4.1-mini': 2, 'anthropic:claude-haiku-4-5-20251001': 1 }
};

/**
 * Get total agent count from mixed model configs.
 * @param {object} mixedModelConfigs - Object mapping model IDs to counts
 * @returns {number} Total agent count
 */
export function getTotalMixedAgents(mixedModelConfigs) {
  if (!mixedModelConfigs) return 0;
  return Object.values(mixedModelConfigs).reduce((sum, count) => sum + (count || 0), 0);
}

/**
 * Convert mixed model configs to API format.
 * @param {object} mixedModelConfigs - Object mapping model IDs to counts
 * @returns {Array} Array of { model, count } objects (only includes models with count >= 1)
 */
export function getMixedModelsArray(mixedModelConfigs) {
  if (!mixedModelConfigs) return [];
  return Object.entries(mixedModelConfigs)
    .filter(([_, count]) => count >= 1)
    .map(([model, count]) => ({ model, count }));
}

/**
 * Get the user's API key for a specific provider.
 * @param {object} settings - User settings object
 * @param {string} model - Model string in format "provider:model-name"
 * @returns {string} API key for the provider
 */
export function getUserApiKey(settings, model) {
  const provider = getProviderFromModel(model);
  switch (provider) {
    case 'openai':
      return settings.openai_api_key || '';
    case 'anthropic':
      return settings.anthropic_api_key || '';
    case 'gemini':
      return settings.gemini_api_key || '';
    default:
      return '';
  }
}

export { HOSTED_CONFIG };

/**
 * Get all settings from storage.
 * @returns {Promise<object>} Settings object with defaults for missing values
 */
export async function getSettings() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(DEFAULT_SETTINGS, (result) => {
        resolve(result);
      });
    } else {
      // Fallback for development outside extension context
      const stored = localStorage.getItem('quorum_settings');
      if (stored) {
        resolve({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    }
  });
}

/**
 * Save settings to storage.
 * @param {object} settings - Settings to save (can be partial)
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set(settings, () => {
        resolve();
      });
    } else {
      // Fallback for development
      const current = localStorage.getItem('quorum_settings');
      const merged = { ...(current ? JSON.parse(current) : {}), ...settings };
      localStorage.setItem('quorum_settings', JSON.stringify(merged));
      resolve();
    }
  });
}

/**
 * Reset all settings to defaults.
 * @returns {Promise<void>}
 */
export async function resetSettings() {
  return saveSettings(DEFAULT_SETTINGS);
}

/**
 * Get a single setting value.
 * @param {string} key - Setting key
 * @returns {Promise<any>} Setting value or default
 */
export async function getSetting(key) {
  const settings = await getSettings();
  return settings[key];
}

export { DEFAULT_SETTINGS };

/**
 * Session state - persists question/image between popup and sidebar
 */
const SESSION_KEY = 'quorum_session';

export async function getSessionState() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(SESSION_KEY, (result) => {
        resolve(result[SESSION_KEY] || { question: '', image: null });
      });
    } else {
      const stored = localStorage.getItem(SESSION_KEY);
      resolve(stored ? JSON.parse(stored) : { question: '', image: null });
    }
  });
}

export async function saveSessionState(state) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [SESSION_KEY]: state }, resolve);
    } else {
      localStorage.setItem(SESSION_KEY, JSON.stringify(state));
      resolve();
    }
  });
}

export async function clearSessionState() {
  return saveSessionState({ question: '', image: null });
}
