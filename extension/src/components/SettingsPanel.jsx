import React, { useState } from 'react';
import {
  saveSettings,
  resetSettings,
  DEFAULT_SETTINGS,
  AVAILABLE_MODELS,
  getTotalMixedAgents,
  FREE_TIER_MODELS,
} from '../utils/storage';

function SettingsPanel({ settings, onSave, onCancel, userTier }) {
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const isPaid = userTier === 'paid';

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const updateMixedModelCount = (modelId, count) => {
    const newConfigs = { ...form.mixed_model_configs };
    const parsed = parseInt(count) || 0;
    if (parsed >= 1) {
      newConfigs[modelId] = parsed;
    } else {
      delete newConfigs[modelId];
    }
    updateField('mixed_model_configs', newConfigs);
  };

  const getMixedModelCount = (modelId) => form.mixed_model_configs?.[modelId] || 0;

  const totalMixedAgents = getTotalMixedAgents(form.mixed_model_configs);

  const providerNames = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google Gemini',
  };

  const isModelAvailable = (modelId) => isPaid || FREE_TIER_MODELS.has(modelId);

  const validate = () => {
    const newErrors = {};

    if (form.mixed_mode) {
      if (totalMixedAgents < 1) newErrors.mixed_models = 'Add at least 1 agent';
      if (totalMixedAgents > 10) newErrors.mixed_models = 'Maximum 10 agents total';
    } else {
      if (form.n_agents < 1 || form.n_agents > 10) newErrors.n_agents = 'Must be between 1 and 10';
      const validPrefixes = ['openai:', 'anthropic:', 'gemini:'];
      if (!validPrefixes.some((p) => form.model.startsWith(p))) newErrors.model = 'Invalid model format';
    }

    if (form.agreement_ratio < 0 || form.agreement_ratio > 1) newErrors.agreement_ratio = 'Must be between 0 and 1';
    if (form.max_rounds < 0 || form.max_rounds > 5) newErrors.max_rounds = 'Must be between 0 and 5';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await saveSettings(form);
      onSave(form);
    } catch {
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
                <div className="relative">
                  <select
                    value={form.model}
                    onChange={(e) => updateField('model', e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:border-quorum-400 focus:ring-2 focus:ring-quorum-100 bg-white"
                  >
                    {Object.entries(AVAILABLE_MODELS).map(([provider, models]) => (
                      <optgroup key={provider} label={providerNames[provider]}>
                        {models.map((model) => (
                          <option key={model.id} value={model.id} disabled={!isModelAvailable(model.id)}>
                            {model.name} ({model.description}){!isModelAvailable(model.id) ? ' — Pro' : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
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
                Configure agents from multiple models. Total:{' '}
                <span className="font-medium text-quorum-600">{totalMixedAgents}</span> / 10
              </p>
              {errors.mixed_models && <p className="text-xs text-red-500">{errors.mixed_models}</p>}

              {Object.entries(AVAILABLE_MODELS).map(([provider, models]) => (
                <div key={provider} className="space-y-2">
                  <span className="text-xs font-medium text-gray-600">{providerNames[provider]}</span>
                  <div className="grid grid-cols-1 gap-2">
                    {models.map((model) => {
                      const available = isModelAvailable(model.id);
                      return (
                        <div key={model.id} className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={getMixedModelCount(model.id)}
                            onChange={(e) => updateMixedModelCount(model.id, e.target.value)}
                            disabled={!available}
                            className="w-14 px-2 py-1 text-sm text-center border border-gray-200 rounded-lg focus:border-quorum-400 focus:ring-2 focus:ring-quorum-100 disabled:bg-gray-50 disabled:text-gray-400"
                          />
                          <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <span className={`text-sm ${!available ? 'text-gray-400' : 'text-gray-700'}`}>
                              {model.name}
                            </span>
                            <span className="text-xs text-gray-400">({model.description})</span>
                            {!available && (
                              <span className="text-xs text-quorum-500 bg-quorum-50 px-1.5 py-0.5 rounded">Pro</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
