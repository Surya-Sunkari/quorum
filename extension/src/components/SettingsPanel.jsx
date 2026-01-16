import React, { useState } from 'react';
import {
  saveSettings,
  resetSettings,
  DEFAULT_SETTINGS,
  HOSTED_CONFIG,
  getProviderFromModel,
  AVAILABLE_MODELS,
  getTotalMixedAgents,
} from '../utils/storage';
import { validateApiKey, checkBackendHealth } from '../utils/api';

function SettingsPanel({ settings, onSave, onCancel }) {
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({}); // Track testing state per provider
  const [testResults, setTestResults] = useState({}); // Track test results per provider
  const [errors, setErrors] = useState({});
  const [devSettingsOpen, setDevSettingsOpen] = useState(false);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  // Helper to update mixed model config counts
  const updateMixedModelCount = (modelId, count) => {
    const newConfigs = { ...form.mixed_model_configs };
    const parsedCount = parseInt(count) || 0;
    if (parsedCount >= 1) {
      newConfigs[modelId] = parsedCount;
    } else {
      delete newConfigs[modelId];
    }
    updateField('mixed_model_configs', newConfigs);
  };

  // Get count for a specific model in mixed mode
  const getMixedModelCount = (modelId) => {
    return form.mixed_model_configs?.[modelId] || 0;
  };

  // Get total agents in mixed mode
  const totalMixedAgents = getTotalMixedAgents(form.mixed_model_configs);

  // Provider display names
  const providerNames = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini',
  };

  const validate = () => {
    const newErrors = {};

    if (form.mixed_mode) {
      // Mixed mode validation
      if (totalMixedAgents < 1) {
        newErrors.mixed_models = 'Add at least 1 agent';
      }
      if (totalMixedAgents > 10) {
        newErrors.mixed_models = 'Maximum 10 agents total';
      }

      // Check API keys for providers used in mixed mode
      if (!form.use_hosted_backend) {
        const providersUsed = new Set();
        Object.keys(form.mixed_model_configs || {}).forEach((modelId) => {
          if (form.mixed_model_configs[modelId] >= 1) {
            providersUsed.add(getProviderFromModel(modelId));
          }
        });
        for (const provider of providersUsed) {
          const apiKeyField = `${provider}_api_key`;
          if (!form[apiKeyField]) {
            newErrors[apiKeyField] = `${providerNames[provider]} API key is required`;
          }
        }
      }
    } else {
      // Single model mode validation
      if (form.n_agents < 1 || form.n_agents > 10) {
        newErrors.n_agents = 'Must be between 1 and 10';
      }

      const validPrefixes = ['openai:', 'anthropic:', 'gemini:'];
      if (!validPrefixes.some((prefix) => form.model.startsWith(prefix))) {
        newErrors.model = 'Invalid model format';
      }

      // Validate API key for selected provider if not using hosted backend
      if (!form.use_hosted_backend) {
        const provider = getProviderFromModel(form.model);
        const apiKeyField = `${provider}_api_key`;
        if (!form[apiKeyField]) {
          newErrors[apiKeyField] = `${providerNames[provider]} API key is required for selected model`;
        }
      }
    }

    if (form.agreement_ratio < 0 || form.agreement_ratio > 1) {
      newErrors.agreement_ratio = 'Must be between 0 and 1';
    }

    if (form.max_rounds < 0 || form.max_rounds > 5) {
      newErrors.max_rounds = 'Must be between 0 and 5';
    }

    // Only validate backend_url if not using hosted backend
    if (!form.use_hosted_backend && !form.backend_url) {
      newErrors.backend_url = 'Backend URL is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if a provider has an API key configured
  const hasApiKey = (provider) => {
    if (form.use_hosted_backend) return true;
    return !!form[`${provider}_api_key`];
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await saveSettings(form);
      onSave(form);
    } catch (err) {
      setErrors({ general: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Reset all settings to defaults?')) {
      await resetSettings();
      setForm({ ...DEFAULT_SETTINGS });
    }
  };

  // Test a specific provider's API key
  const handleTestKey = async (provider) => {
    const apiKey = form[`${provider}_api_key`];
    if (!apiKey) {
      setTestResults((prev) => ({ ...prev, [provider]: { valid: false, error: 'Please enter an API key' } }));
      return;
    }

    setTesting((prev) => ({ ...prev, [provider]: true }));
    setTestResults((prev) => ({ ...prev, [provider]: null }));

    try {
      // First check if backend is reachable
      const backendOk = await checkBackendHealth(form.backend_url);
      if (!backendOk) {
        setTestResults((prev) => ({
          ...prev,
          [provider]: { valid: false, error: 'Cannot reach backend. Is it running?' },
        }));
        return;
      }

      const result = await validateApiKey(form.backend_url, apiKey, provider);
      setTestResults((prev) => ({ ...prev, [provider]: result }));
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [provider]: { valid: false, error: err.message } }));
    } finally {
      setTesting((prev) => ({ ...prev, [provider]: false }));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl hover:bg-gray-100 active:bg-gray-200"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Agent Configuration */}
        <div className="bg-white rounded-2xl shadow-bubbly p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Agent Configuration</h3>
            {/* Mixed Mode Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-500">Mixed Models</span>
              <button
                type="button"
                onClick={() => updateField('mixed_mode', !form.mixed_mode)}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  form.mixed_mode ? 'bg-quorum-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    form.mixed_mode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>
          </div>

          {!form.mixed_mode ? (
            /* Single Model Mode */
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <select
                  value={form.model}
                  onChange={(e) => updateField('model', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-quorum-400 focus:ring-2 focus:ring-quorum-100 bg-white"
                >
                  <optgroup label={`OpenAI${!hasApiKey('openai') ? ' (No API Key)' : ''}`}>
                    <option value="openai:gpt-4.1-mini" disabled={!hasApiKey('openai')}>GPT-4.1 Mini (Fast)</option>
                    <option value="openai:gpt-4.1" disabled={!hasApiKey('openai')}>GPT-4.1</option>
                    <option value="openai:gpt-5-mini" disabled={!hasApiKey('openai')}>GPT-5 Mini</option>
                    <option value="openai:gpt-5.1" disabled={!hasApiKey('openai')}>GPT-5.1</option>
                    <option value="openai:gpt-5.2" disabled={!hasApiKey('openai')}>GPT-5.2 (Latest)</option>
                  </optgroup>
                  <optgroup label={`Anthropic${!hasApiKey('anthropic') ? ' (No API Key)' : ''}`}>
                    <option value="anthropic:claude-haiku-4-5-20251001" disabled={!hasApiKey('anthropic')}>Claude Haiku 4.5 (Fast)</option>
                    <option value="anthropic:claude-sonnet-4-5-20250929" disabled={!hasApiKey('anthropic')}>Claude Sonnet 4.5</option>
                    <option value="anthropic:claude-opus-4-5-20251101" disabled={!hasApiKey('anthropic')}>Claude Opus 4.5 (Latest)</option>
                  </optgroup>
                  <optgroup label={`Google${!hasApiKey('gemini') ? ' (No API Key)' : ''}`}>
                    <option value="gemini:gemini-2.5-flash" disabled={!hasApiKey('gemini')}>Gemini 2.5 Flash (Fast)</option>
                    <option value="gemini:gemini-3-flash-preview" disabled={!hasApiKey('gemini')}>Gemini 3 Flash</option>
                    <option value="gemini:gemini-3-pro-preview" disabled={!hasApiKey('gemini')}>Gemini 3 Pro (Latest)</option>
                  </optgroup>
                </select>
                {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Number of Agents</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={form.n_agents}
                    onChange={(e) => updateField('n_agents', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-quorum-400 focus:ring-2 focus:ring-quorum-100"
                  />
                  {errors.n_agents && <p className="text-xs text-red-500 mt-1">{errors.n_agents}</p>}
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Rounds</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={form.max_rounds}
                    onChange={(e) => updateField('max_rounds', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-quorum-400 focus:ring-2 focus:ring-quorum-100"
                  />
                  {errors.max_rounds && <p className="text-xs text-red-500 mt-1">{errors.max_rounds}</p>}
                </div>
              </div>
            </>
          ) : (
            /* Mixed Model Mode */
            <>
              <p className="text-xs text-gray-500">
                Configure agents from multiple models. Total: <span className="font-medium text-quorum-600">{totalMixedAgents}</span> / 10
              </p>
              {errors.mixed_models && <p className="text-xs text-red-500">{errors.mixed_models}</p>}

              {/* Provider sections */}
              {Object.entries(AVAILABLE_MODELS).map(([provider, models]) => (
                <div key={provider} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600">{providerNames[provider]}</span>
                    {!hasApiKey(provider) && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">No API Key</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {models.map((model) => (
                      <div key={model.id} className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={getMixedModelCount(model.id)}
                          onChange={(e) => updateMixedModelCount(model.id, e.target.value)}
                          disabled={!hasApiKey(provider)}
                          className="w-14 px-2 py-1 text-sm text-center border border-gray-200 rounded-lg focus:border-quorum-400 focus:ring-2 focus:ring-quorum-100 disabled:bg-gray-50 disabled:text-gray-400"
                        />
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm ${!hasApiKey(provider) ? 'text-gray-400' : 'text-gray-700'}`}>
                            {model.name}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">({model.description})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Rounds</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={form.max_rounds}
                  onChange={(e) => updateField('max_rounds', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-quorum-400 focus:ring-2 focus:ring-quorum-100"
                />
                {errors.max_rounds && <p className="text-xs text-red-500 mt-1">{errors.max_rounds}</p>}
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Agreement Ratio: {Math.round(form.agreement_ratio * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(form.agreement_ratio * 100)}
              onChange={(e) => updateField('agreement_ratio', parseInt(e.target.value) / 100)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-quorum-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Any (0%)</span>
              <span>All (100%)</span>
            </div>
          </div>
        </div>

        {/* Debug Settings */}
        <div className="bg-white rounded-2xl shadow-bubbly p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Debug & Display</h3>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.debug_mode}
              onChange={(e) => updateField('debug_mode', e.target.checked)}
              className="w-4 h-4 text-quorum-500 border-gray-300 rounded focus:ring-quorum-400"
            />
            <div>
              <span className="text-sm text-gray-700">Debug Mode</span>
              <p className="text-xs text-gray-400">Show per-agent outputs and clusters</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.return_agent_outputs}
              onChange={(e) => updateField('return_agent_outputs', e.target.checked)}
              className="w-4 h-4 text-quorum-500 border-gray-300 rounded focus:ring-quorum-400"
            />
            <div>
              <span className="text-sm text-gray-700">Return Agent Outputs</span>
              <p className="text-xs text-gray-400">Include individual agent responses</p>
            </div>
          </label>
        </div>

        {/* Developer Settings (Collapsible) */}
        <div className="bg-white rounded-2xl shadow-bubbly overflow-hidden">
          <button
            onClick={() => setDevSettingsOpen(!devSettingsOpen)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h3 className="text-sm font-medium text-gray-700">Developer Settings</h3>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${devSettingsOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {devSettingsOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
              {/* Hosted Backend Toggle */}
              <div className="pt-3 flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-700">Use Hosted Backend</span>
                  <p className="text-xs text-gray-400">Use Quorum's servers (no API key needed)</p>
                </div>
                <button
                  onClick={() => updateField('use_hosted_backend', !form.use_hosted_backend)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    form.use_hosted_backend ? 'bg-quorum-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.use_hosted_backend ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {!form.use_hosted_backend && (
                <>
                  {/* OpenAI API Key */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">OpenAI API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={form.openai_api_key || ''}
                        onChange={(e) => updateField('openai_api_key', e.target.value)}
                        placeholder="sk-..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-quorum-400 focus:ring-2 focus:ring-quorum-100"
                      />
                      <button
                        onClick={() => handleTestKey('openai')}
                        disabled={testing.openai}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {testing.openai ? '...' : 'Test'}
                      </button>
                    </div>
                    {testResults.openai && (
                      <p className={`text-xs mt-1 ${testResults.openai.valid ? 'text-green-600' : 'text-red-500'}`}>
                        {testResults.openai.valid ? 'API key is valid!' : testResults.openai.error}
                      </p>
                    )}
                    {errors.openai_api_key && (
                      <p className="text-xs text-red-500 mt-1">{errors.openai_api_key}</p>
                    )}
                  </div>

                  {/* Anthropic API Key */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Anthropic API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={form.anthropic_api_key || ''}
                        onChange={(e) => updateField('anthropic_api_key', e.target.value)}
                        placeholder="sk-ant-..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-quorum-400 focus:ring-2 focus:ring-quorum-100"
                      />
                      <button
                        onClick={() => handleTestKey('anthropic')}
                        disabled={testing.anthropic}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {testing.anthropic ? '...' : 'Test'}
                      </button>
                    </div>
                    {testResults.anthropic && (
                      <p className={`text-xs mt-1 ${testResults.anthropic.valid ? 'text-green-600' : 'text-red-500'}`}>
                        {testResults.anthropic.valid ? 'API key is valid!' : testResults.anthropic.error}
                      </p>
                    )}
                    {errors.anthropic_api_key && (
                      <p className="text-xs text-red-500 mt-1">{errors.anthropic_api_key}</p>
                    )}
                  </div>

                  {/* Gemini API Key */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Google Gemini API Key</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={form.gemini_api_key || ''}
                        onChange={(e) => updateField('gemini_api_key', e.target.value)}
                        placeholder="AIza..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-quorum-400 focus:ring-2 focus:ring-quorum-100"
                      />
                      <button
                        onClick={() => handleTestKey('gemini')}
                        disabled={testing.gemini}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {testing.gemini ? '...' : 'Test'}
                      </button>
                    </div>
                    {testResults.gemini && (
                      <p className={`text-xs mt-1 ${testResults.gemini.valid ? 'text-green-600' : 'text-red-500'}`}>
                        {testResults.gemini.valid ? 'API key is valid!' : testResults.gemini.error}
                      </p>
                    )}
                    {errors.gemini_api_key && (
                      <p className="text-xs text-red-500 mt-1">{errors.gemini_api_key}</p>
                    )}
                  </div>

                  {/* Backend URL */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Backend URL</label>
                    <input
                      type="text"
                      value={form.backend_url}
                      onChange={(e) => updateField('backend_url', e.target.value)}
                      placeholder="http://localhost:5000"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-quorum-400 focus:ring-2 focus:ring-quorum-100"
                    />
                    {errors.backend_url && (
                      <p className="text-xs text-red-500 mt-1">{errors.backend_url}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm text-white bg-gradient-to-r from-quorum-500 to-quorum-600 rounded-xl shadow-bubbly hover:shadow-bubbly-lg disabled:opacity-50 transition-all"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {errors.general && (
          <p className="text-xs text-red-500 text-center">{errors.general}</p>
        )}
      </div>
    </div>
  );
}

export default SettingsPanel;
