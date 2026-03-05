import { describe, it, expect, vi, beforeEach } from 'vitest';
import { askQuestion, getUserInfo, createCheckoutSession, checkBackendHealth } from '../../utils/api';

const BACKEND = 'http://localhost:5000';

beforeEach(() => {
  global.fetch = vi.fn();
});


describe('askQuestion', () => {
  it('sends correct request and returns response', async () => {
    const responseData = { status: 'consensus_reached', answer: '42' };
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseData),
    });

    const result = await askQuestion(BACKEND, { question: 'test', model: 'openai:gpt-4.1-mini' }, 'jwt-token');

    expect(global.fetch).toHaveBeenCalledWith(
      `${BACKEND}/ask`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer jwt-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result).toEqual(responseData);
  });

  it('throws on 401 with error details', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Token expired', code: 'TOKEN_EXPIRED' }),
    });

    try {
      await askQuestion(BACKEND, { question: 'test' }, 'bad-token');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(401);
      expect(err.message).toContain('Token expired');
    }
  });

  it('throws on 403 with upgrade required', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Upgrade required', code: 'UPGRADE_REQUIRED' }),
    });

    try {
      await askQuestion(BACKEND, { question: 'test' }, 'token');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(403);
      expect(err.details.code).toBe('UPGRADE_REQUIRED');
    }
  });

  it('throws on 429 with usage limit', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Limit reached', code: 'USAGE_LIMIT_REACHED' }),
    });

    try {
      await askQuestion(BACKEND, { question: 'test' }, 'token');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(429);
    }
  });

  it('handles json parse failure in error response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });

    try {
      await askQuestion(BACKEND, { question: 'test' }, 'token');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.message).toContain('Unknown error');
    }
  });
});


describe('getUserInfo', () => {
  it('returns user info on success', async () => {
    const userData = { email: 'a@b.com', tier: 'free', usage: { count: 5, limit: 20 } };
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(userData),
    });

    const result = await getUserInfo(BACKEND, 'jwt-token');
    expect(result).toEqual(userData);
  });

  it('throws on failure', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 401 });

    await expect(getUserInfo(BACKEND, 'bad-token')).rejects.toThrow('Failed to load user info');
  });
});


describe('createCheckoutSession', () => {
  it('returns checkout URL', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ checkout_url: 'https://checkout.stripe.com/s1' }),
    });

    const result = await createCheckoutSession(BACKEND, 'token', 'standard');
    expect(result.checkout_url).toBe('https://checkout.stripe.com/s1');
  });

  it('sends plan in body', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ checkout_url: 'url' }),
    });

    await createCheckoutSession(BACKEND, 'token', 'pro');

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.plan).toBe('pro');
  });

  it('throws on failure', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Already on paid tier' }),
    });

    await expect(createCheckoutSession(BACKEND, 'token', 'pro')).rejects.toThrow('Already on paid tier');
  });
});


describe('checkBackendHealth', () => {
  it('returns true when healthy', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    expect(await checkBackendHealth(BACKEND)).toBe(true);
  });

  it('returns false on error', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    expect(await checkBackendHealth(BACKEND)).toBe(false);
  });

  it('returns false when status is not ok', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'error' }),
    });

    expect(await checkBackendHealth(BACKEND)).toBe(false);
  });
});
