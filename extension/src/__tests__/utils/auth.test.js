import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStoredAuth, signOut, signInWithGoogle, refreshAuthIfNeeded } from '../../utils/auth';

beforeEach(() => {
  global.fetch = vi.fn();
  vi.clearAllMocks();
});


describe('getStoredAuth', () => {
  it('returns null when no auth stored', async () => {
    const result = await getStoredAuth();
    expect(result).toBeNull();
  });

  it('returns stored auth data', async () => {
    const authData = { token: 'jwt-123', user: { id: 'u1', email: 'a@b.com', tier: 'free' } };
    chrome.storage.local.get.mockImplementation((key, cb) => {
      cb({ quorum_auth: authData });
    });

    const result = await getStoredAuth();
    expect(result).toEqual(authData);
  });
});


describe('signOut', () => {
  it('removes auth from storage', async () => {
    await signOut();
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('quorum_auth', expect.any(Function));
  });
});


describe('signInWithGoogle', () => {
  it('launches OAuth, exchanges token, stores auth', async () => {
    // Mock OAuth flow
    chrome.identity.launchWebAuthFlow.mockImplementation((opts, cb) => {
      cb('https://test-ext-id.chromiumapp.org/#access_token=google-token-123&token_type=bearer');
    });
    chrome.runtime.lastError = null;

    // Mock backend exchange
    const authData = { token: 'jwt-456', user: { id: 'u1', email: 'a@b.com', tier: 'free' } };
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(authData),
    });

    const result = await signInWithGoogle();

    expect(result).toEqual(authData);
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: true }),
      expect.any(Function),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/google'),
      expect.objectContaining({ method: 'POST' }),
    );
    // Auth should be stored
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('rejects when OAuth flow fails', async () => {
    chrome.runtime.lastError = { message: 'User cancelled' };
    chrome.identity.launchWebAuthFlow.mockImplementation((opts, cb) => {
      cb(undefined);
    });

    await expect(signInWithGoogle()).rejects.toThrow('User cancelled');
    chrome.runtime.lastError = null;
  });

  it('rejects when no access token in redirect', async () => {
    chrome.runtime.lastError = null;
    chrome.identity.launchWebAuthFlow.mockImplementation((opts, cb) => {
      cb('https://test-ext-id.chromiumapp.org/#error=access_denied');
    });

    await expect(signInWithGoogle()).rejects.toThrow('No access token');
  });
});


describe('refreshAuthIfNeeded', () => {
  it('returns null when no stored auth', async () => {
    chrome.storage.local.get.mockImplementation((key, cb) => cb({}));

    const result = await refreshAuthIfNeeded();
    expect(result).toBeNull();
  });

  it('returns stored auth if token is not expired', async () => {
    // Create a JWT with exp far in the future
    const payload = { exp: Math.floor(Date.now() / 1000) + 86400 }; // +24h
    const fakeJwt = `header.${btoa(JSON.stringify(payload))}.signature`;
    const authData = { token: fakeJwt, user: { id: 'u1' } };

    chrome.storage.local.get.mockImplementation((key, cb) => {
      cb({ quorum_auth: authData });
    });

    const result = await refreshAuthIfNeeded();
    expect(result).toEqual(authData);
  });

  it('attempts silent re-auth when token is expired', async () => {
    // Create an expired JWT
    const payload = { exp: Math.floor(Date.now() / 1000) - 3600 }; // -1h
    const fakeJwt = `header.${btoa(JSON.stringify(payload))}.signature`;
    const expiredAuth = { token: fakeJwt, user: { id: 'u1' } };

    chrome.storage.local.get.mockImplementation((key, cb) => {
      cb({ quorum_auth: expiredAuth });
    });

    // Mock silent re-auth success
    chrome.identity.launchWebAuthFlow.mockImplementation((opts, cb) => {
      cb('https://test-ext-id.chromiumapp.org/#access_token=new-token&token_type=bearer');
    });
    chrome.runtime.lastError = null;

    const newAuth = { token: 'new-jwt', user: { id: 'u1', tier: 'free' } };
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(newAuth),
    });

    const result = await refreshAuthIfNeeded();
    expect(result).toEqual(newAuth);
    // Should have called with interactive: false
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: false }),
      expect.any(Function),
    );
  });

  it('returns null and signs out when silent re-auth fails', async () => {
    const payload = { exp: Math.floor(Date.now() / 1000) - 3600 };
    const fakeJwt = `header.${btoa(JSON.stringify(payload))}.signature`;
    const expiredAuth = { token: fakeJwt, user: { id: 'u1' } };

    chrome.storage.local.get.mockImplementation((key, cb) => {
      cb({ quorum_auth: expiredAuth });
    });

    // Silent OAuth fails
    chrome.runtime.lastError = { message: 'Not signed in' };
    chrome.identity.launchWebAuthFlow.mockImplementation((opts, cb) => {
      cb(undefined);
    });

    const result = await refreshAuthIfNeeded();
    expect(result).toBeNull();
    // Should have called signOut
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('quorum_auth', expect.any(Function));
    chrome.runtime.lastError = null;
  });
});
