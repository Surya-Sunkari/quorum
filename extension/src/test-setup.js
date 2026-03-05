import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock chrome.* APIs globally
const chromeStorageData = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        if (typeof keys === 'string') {
          callback({ [keys]: chromeStorageData[keys] });
        } else if (typeof keys === 'object' && !Array.isArray(keys)) {
          // keys is defaults object
          const result = { ...keys };
          for (const key of Object.keys(keys)) {
            if (chromeStorageData[key] !== undefined) {
              result[key] = chromeStorageData[key];
            }
          }
          callback(result);
        } else {
          callback({});
        }
      }),
      set: vi.fn((items, callback) => {
        Object.assign(chromeStorageData, items);
        if (callback) callback();
      }),
      remove: vi.fn((key, callback) => {
        if (Array.isArray(key)) {
          key.forEach(k => delete chromeStorageData[k]);
        } else {
          delete chromeStorageData[key];
        }
        if (callback) callback();
      }),
    },
  },
  identity: {
    launchWebAuthFlow: vi.fn(),
    getRedirectURL: vi.fn(() => 'https://test-ext-id.chromiumapp.org/'),
  },
  runtime: {
    sendMessage: vi.fn(),
    id: 'test-extension-id',
    lastError: null,
  },
  tabs: {
    create: vi.fn(),
    query: vi.fn(),
  },
  sidePanel: {
    open: vi.fn(),
    setPanelBehavior: vi.fn(),
  },
};

// Mock import.meta.env
vi.stubEnv('VITE_HOSTED_BACKEND_URL', 'http://localhost:5000');
vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
vi.stubEnv('VITE_FRONTEND_URL', 'http://localhost:3000');

// Mock KaTeX
vi.mock('katex', () => ({
  default: {
    renderToString: vi.fn((tex) => `<span class="katex">${tex}</span>`),
  },
}));

// Reset storage between tests
beforeEach(() => {
  Object.keys(chromeStorageData).forEach(key => delete chromeStorageData[key]);
  vi.clearAllMocks();
});
