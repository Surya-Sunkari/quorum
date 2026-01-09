import React, { useState } from 'react';
import { saveSettings, resetSettings, DEFAULT_SETTINGS } from '../utils/storage';
import { validateApiKey, checkBackendHealth } from '../utils/api';

function SettingsPanel({ settings, onSave, onCancel }) {
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [errors, setErrors] = useState({});

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const newErrors = {};

    if (form.n_agents < 1 || form.n_agents > 10) {
      newErrors.n_agents = 'Must be between 1 and 10';
    }

    if (form.agreement_ratio < 0 || form.agreement_ratio > 1) {
      newErrors.agreement_ratio = 'Must be between 0 and 1';
    }

    if (form.max_rounds < 0 || form.max_rounds > 5) {
      newErrors.max_rounds = 'Must be between 0 and 5';
    }

    if (!form.model.startsWith('openai:')) {
      newErrors.model = 'Must start with "openai:"';
    }

    if (!form.backend_url) {
      newErrors.backend_url = 'Backend URL is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  const handleTestKey = async () => {
    if (!form.api_key) {
      setTestResult({ valid: false, error: 'Please enter an API key' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // First check if backend is reachable
      const backendOk = await checkBackendHealth(form.backend_url);
      if (!backendOk) {
        setTestResult({
          valid: false,
          error: 'Cannot reach backend. Is it running?',
        });
        return;
      }

      const result = await validateApiKey(form.backend_url, form.api_key, form.model);
      setTestResult(result);
    } catch (err) {
      setTestResult({ valid: false, error: err.message });
    } finally {
      setTesting(false);
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

        {/* API Key */}
        <div className="bg-white rounded-2xl shadow-bubbly p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">API Configuration</h3>

          <div>
            <label className="block text-xs text-gray-500 mb-1">OpenAI API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={form.api_key}
                onChange={(e) => updateField('api_key', e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                onClick={handleTestKey}
                disabled={testing}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                {testing ? '...' : 'Test'}
              </button>
            </div>
            {testResult && (
              <p className={`text-xs mt-1 ${testResult.valid ? 'text-green-600' : 'text-red-500'}`}>
                {testResult.valid ? 'API key is valid!' : testResult.error}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Model</label>
            <select
              value={form.model}
              onChange={(e) => updateField('model', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
            >
              <option value="openai:gpt-4o-mini">GPT-4o Mini (Fast, Cheap)</option>
              <option value="openai:gpt-4o">GPT-4o (Balanced)</option>
              <option value="openai:gpt-4-turbo">GPT-4 Turbo</option>
              <option value="openai:o1-mini">o1-mini (Reasoning)</option>
            </select>
            {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Backend URL</label>
            <input
              type="text"
              value={form.backend_url}
              onChange={(e) => updateField('backend_url', e.target.value)}
              placeholder="http://localhost:5000"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            {errors.backend_url && <p className="text-xs text-red-500 mt-1">{errors.backend_url}</p>}
          </div>
        </div>

        {/* Agent Settings */}
        <div className="bg-white rounded-2xl shadow-bubbly p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Agent Configuration</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Number of Agents</label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.n_agents}
                onChange={(e) => updateField('n_agents', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              {errors.max_rounds && <p className="text-xs text-red-500 mt-1">{errors.max_rounds}</p>}
            </div>
          </div>

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
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
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
              className="w-4 h-4 text-indigo-500 border-gray-300 rounded focus:ring-indigo-400"
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
              className="w-4 h-4 text-indigo-500 border-gray-300 rounded focus:ring-indigo-400"
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
            className="flex-1 px-4 py-2 text-sm text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl shadow-bubbly hover:shadow-bubbly-lg disabled:opacity-50 transition-all"
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
