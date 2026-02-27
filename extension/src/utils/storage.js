/**
 * Storage utilities for Chrome extension settings.
 * Uses chrome.storage.local for persistence.
 */

// Quorum hosted backend configuration
export const HOSTED_CONFIG = {
  backend_url: import.meta.env.VITE_HOSTED_BACKEND_URL || 'http://localhost:5000',
};

/**
 * Models available on the free tier.
 */
export const FREE_TIER_MODELS = new Set([
  'openai:gpt-4.1-mini',
  'anthropic:claude-haiku-4-5',
  'gemini:gemini-2.5-flash',
]);

/**
 * Available models organized by provider.
 * Each model has: id, name, description, tier ('free' | 'paid').
 * To add, rename, or remove a model, edit this object only.
 */
export const AVAILABLE_MODELS = {
  openai: [
    { id: 'openai:gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Fast', tier: 'free' },
    { id: 'openai:gpt-4.1', name: 'GPT-4.1', description: 'Balanced', tier: 'paid' },
    { id: 'openai:gpt-5-mini', name: 'GPT-5 Mini', description: 'Fast, capable', tier: 'paid' },
    { id: 'openai:gpt-5.1', name: 'GPT-5.1', description: 'High capability', tier: 'paid' },
    { id: 'openai:gpt-5.2', name: 'GPT-5.2', description: 'Latest', tier: 'paid' },
  ],
  anthropic: [
    { id: 'anthropic:claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Fast', tier: 'free' },
    { id: 'anthropic:claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Balanced', tier: 'paid' },
    { id: 'anthropic:claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Most capable', tier: 'paid' },
  ],
  gemini: [
    { id: 'gemini:gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast', tier: 'free' },
    { id: 'gemini:gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Fast, capable', tier: 'paid' },
    { id: 'gemini:gemini-3-pro-preview', name: 'Gemini 3 Pro', description: 'Most capable', tier: 'paid' },
  ],
};

/**
 * Map of model IDs to friendly display names.
 * Derived from AVAILABLE_MODELS — do not edit directly, update AVAILABLE_MODELS instead.
 */
export const MODEL_DISPLAY_NAMES = Object.fromEntries(
  Object.values(AVAILABLE_MODELS).flat().map(({ id, name }) => [id, name])
);

/**
 * Get a friendly display name for a model ID.
 * @param {string} modelId - Model ID in format 'provider:model-name'
 * @returns {string} Friendly display name
 */
export function getModelDisplayName(modelId) {
  if (!modelId) return '';
  if (MODEL_DISPLAY_NAMES[modelId]) return MODEL_DISPLAY_NAMES[modelId];
  const parts = modelId.split(':');
  if (parts.length === 2) {
    return parts[1]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return modelId;
}

/**
 * Get the provider name from a model string.
 * @param {string} model - Model string in format "provider:model-name"
 * @returns {string} Provider name (openai, anthropic, gemini)
 */
export function getProviderFromModel(model) {
  if (model.startsWith('openai:')) return 'openai';
  if (model.startsWith('anthropic:')) return 'anthropic';
  if (model.startsWith('gemini:')) return 'gemini';
  return 'openai';
}

export const DEFAULT_SETTINGS = {
  n_agents: 3,
  agreement_ratio: 0.67,
  max_rounds: 2,
  model: 'openai:gpt-4.1-mini',
  return_agent_outputs: false,
  debug_mode: false,
  // Mixed-model mode settings
  mixed_mode: false,
  mixed_model_configs: {}, // { 'openai:gpt-4.1-mini': 2, 'anthropic:claude-haiku-4-5': 1 }
};

/**
 * Get total agent count from mixed model configs.
 */
export function getTotalMixedAgents(mixedModelConfigs) {
  if (!mixedModelConfigs) return 0;
  return Object.values(mixedModelConfigs).reduce((sum, count) => sum + (count || 0), 0);
}

/**
 * Convert mixed model configs to API format.
 */
export function getMixedModelsArray(mixedModelConfigs) {
  if (!mixedModelConfigs) return [];
  return Object.entries(mixedModelConfigs)
    .filter(([_, count]) => count >= 1)
    .map(([model, count]) => ({ model, count }));
}

/**
 * Get all settings from storage.
 */
export async function getSettings() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(DEFAULT_SETTINGS, (result) => {
        resolve(result);
      });
    } else {
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
 * Save settings to storage (can be partial).
 */
export async function saveSettings(settings) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set(settings, () => {
        resolve();
      });
    } else {
      const current = localStorage.getItem('quorum_settings');
      const merged = { ...(current ? JSON.parse(current) : {}), ...settings };
      localStorage.setItem('quorum_settings', JSON.stringify(merged));
      resolve();
    }
  });
}

/**
 * Reset all settings to defaults.
 */
export async function resetSettings() {
  return saveSettings(DEFAULT_SETTINGS);
}

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
