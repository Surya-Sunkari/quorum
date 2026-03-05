import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isModelAccessible,
  getModelDisplayName,
  getProviderFromModel,
  getTotalMixedAgents,
  getMixedModelsArray,
  getSettings,
  saveSettings,
  resetSettings,
  getSessionState,
  saveSessionState,
  clearSessionState,
  DEFAULT_SETTINGS,
  FREE_TIER_MODELS,
  STANDARD_TIER_MODELS,
} from '../../utils/storage';


describe('isModelAccessible', () => {
  it('free user can access free model', () => {
    expect(isModelAccessible('free', 'free')).toBe(true);
  });

  it('free user cannot access standard model', () => {
    expect(isModelAccessible('standard', 'free')).toBe(false);
  });

  it('free user cannot access pro model', () => {
    expect(isModelAccessible('pro', 'free')).toBe(false);
  });

  it('standard user can access free model', () => {
    expect(isModelAccessible('free', 'standard')).toBe(true);
  });

  it('standard user can access standard model', () => {
    expect(isModelAccessible('standard', 'standard')).toBe(true);
  });

  it('standard user cannot access pro model', () => {
    expect(isModelAccessible('pro', 'standard')).toBe(false);
  });

  it('pro user can access any model', () => {
    expect(isModelAccessible('free', 'pro')).toBe(true);
    expect(isModelAccessible('standard', 'pro')).toBe(true);
    expect(isModelAccessible('pro', 'pro')).toBe(true);
  });
});


describe('getModelDisplayName', () => {
  it('returns friendly name for known model', () => {
    expect(getModelDisplayName('openai:gpt-4.1-mini')).toBe('GPT-4.1 Mini');
  });

  it('returns formatted name for unknown model', () => {
    const name = getModelDisplayName('openai:unknown-model');
    expect(name).toBe('Unknown Model');
  });

  it('returns model ID when no colon', () => {
    expect(getModelDisplayName('rawmodel')).toBe('rawmodel');
  });

  it('returns empty string for empty/null input', () => {
    expect(getModelDisplayName('')).toBe('');
    expect(getModelDisplayName(null)).toBe('');
    expect(getModelDisplayName(undefined)).toBe('');
  });
});


describe('getProviderFromModel', () => {
  it('identifies openai', () => {
    expect(getProviderFromModel('openai:gpt-4.1-mini')).toBe('openai');
  });

  it('identifies anthropic', () => {
    expect(getProviderFromModel('anthropic:claude-haiku-4-5')).toBe('anthropic');
  });

  it('identifies gemini', () => {
    expect(getProviderFromModel('gemini:gemini-2.5-flash')).toBe('gemini');
  });

  it('defaults to openai for unknown', () => {
    expect(getProviderFromModel('unknown:model')).toBe('openai');
  });
});


describe('getTotalMixedAgents', () => {
  it('sums agent counts', () => {
    expect(getTotalMixedAgents({
      'openai:gpt-4.1-mini': 2,
      'anthropic:claude-haiku-4-5': 1,
    })).toBe(3);
  });

  it('returns 0 for null/undefined', () => {
    expect(getTotalMixedAgents(null)).toBe(0);
    expect(getTotalMixedAgents(undefined)).toBe(0);
  });

  it('returns 0 for empty config', () => {
    expect(getTotalMixedAgents({})).toBe(0);
  });

  it('handles zero counts', () => {
    expect(getTotalMixedAgents({ 'openai:gpt-4.1-mini': 0 })).toBe(0);
  });
});


describe('getMixedModelsArray', () => {
  it('converts config to API format', () => {
    const result = getMixedModelsArray({
      'openai:gpt-4.1-mini': 2,
      'anthropic:claude-haiku-4-5': 1,
    });
    expect(result).toEqual([
      { model: 'openai:gpt-4.1-mini', count: 2 },
      { model: 'anthropic:claude-haiku-4-5', count: 1 },
    ]);
  });

  it('filters out zero counts', () => {
    const result = getMixedModelsArray({
      'openai:gpt-4.1-mini': 2,
      'anthropic:claude-haiku-4-5': 0,
    });
    expect(result).toEqual([
      { model: 'openai:gpt-4.1-mini', count: 2 },
    ]);
  });

  it('returns empty array for null', () => {
    expect(getMixedModelsArray(null)).toEqual([]);
  });
});


describe('getSettings', () => {
  it('returns defaults when no settings stored', async () => {
    const settings = await getSettings();
    expect(settings.n_agents).toBe(3);
    expect(settings.agreement_ratio).toBe(0.67);
    expect(settings.model).toBe('openai:gpt-4.1-mini');
  });
});


describe('saveSettings', () => {
  it('saves partial settings', async () => {
    await saveSettings({ n_agents: 5 });
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });
});


describe('resetSettings', () => {
  it('restores defaults', async () => {
    await resetSettings();
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      DEFAULT_SETTINGS,
      expect.any(Function),
    );
  });
});


describe('getSessionState', () => {
  it('returns default state when empty', async () => {
    const state = await getSessionState();
    expect(state).toEqual({ question: '', image: null });
  });
});


describe('saveSessionState / clearSessionState', () => {
  it('saves and clears session state', async () => {
    await saveSessionState({ question: 'test', image: 'img' });
    expect(chrome.storage.local.set).toHaveBeenCalled();

    await clearSessionState();
    // clearSessionState calls saveSessionState with defaults
    const lastCall = chrome.storage.local.set.mock.calls.at(-1);
    expect(lastCall[0]).toEqual({ quorum_session: { question: '', image: null } });
  });
});


describe('FREE_TIER_MODELS', () => {
  it('contains exactly 3 models', () => {
    expect(FREE_TIER_MODELS.size).toBe(3);
  });

  it('includes one model per provider', () => {
    const providers = [...FREE_TIER_MODELS].map(m => m.split(':')[0]);
    expect(providers.sort()).toEqual(['anthropic', 'gemini', 'openai']);
  });
});


describe('STANDARD_TIER_MODELS', () => {
  it('is superset of free tier', () => {
    for (const model of FREE_TIER_MODELS) {
      expect(STANDARD_TIER_MODELS.has(model)).toBe(true);
    }
  });

  it('contains 6 models', () => {
    expect(STANDARD_TIER_MODELS.size).toBe(6);
  });
});
