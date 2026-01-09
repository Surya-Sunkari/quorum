/**
 * Storage utilities for Chrome extension settings.
 * Uses chrome.storage.local for persistence.
 */

const DEFAULT_SETTINGS = {
  n_agents: 3,
  agreement_ratio: 0.67,
  max_rounds: 2,
  model: 'openai:gpt-4.1-mini',
  api_key: '',
  return_agent_outputs: false,
  debug_mode: false,
  backend_url: 'http://localhost:5000',
};

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
