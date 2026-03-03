import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import QuestionInput from './components/QuestionInput';
import AnswerCard from './components/AnswerCard';
import SettingsPanel from './components/SettingsPanel';
import LoginScreen from './components/LoginScreen';
import LoadingState from './components/LoadingState';
import ErrorMessage from './components/ErrorMessage';
import UsageDisplay from './components/UsageDisplay';
import {
  getSettings,
  getSessionState,
  saveSessionState,
  HOSTED_CONFIG,
  getMixedModelsArray,
  getTotalMixedAgents,
} from './utils/storage';
import { askQuestion, getUserInfo, createCheckoutSession } from './utils/api';
import { getStoredAuth, signOut, refreshAuthIfNeeded } from './utils/auth';

function App() {
  const [settings, setSettings] = useState(null);
  const [auth, setAuth] = useState(null);          // { token, user: { id, email, tier } }
  const [usageInfo, setUsageInfo] = useState(null); // { count, limit, period }
  const [authLoading, setAuthLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [question, setQuestion] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);

  const backendUrl = HOSTED_CONFIG.backend_url;

  // Load settings, session state, and auth on mount
  useEffect(() => {
    let upgradePollInterval = null;

    getSettings().then(setSettings);
    getSessionState().then((session) => {
      if (session.question) setQuestion(session.question);
      if (session.image) setImage(session.image);
    });

    // Check for existing auth (refresh if token is expired), then sync tier from server
    refreshAuthIfNeeded().then(async (stored) => {
      if (stored?.token) {
        try {
          const info = await getUserInfo(HOSTED_CONFIG.backend_url, stored.token);
          if (info.tier !== stored.user?.tier) {
            stored = { ...stored, user: { ...stored.user, tier: info.tier } };
          }
          setUsageInfo(info.usage);
        } catch {
          // non-fatal — use cached tier
        }
      }
      setAuth(stored);
      setAuthLoading(false);

      // If upgrade was started before popup closed, resume polling for tier change
      const isPaid = stored?.user?.tier === 'standard' || stored?.user?.tier === 'pro';
      if (stored?.token && !isPaid && typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get('quorum_upgrade_pending', (result) => {
          const pendingSince = result.quorum_upgrade_pending;
          const remainingMs = pendingSince ? 10 * 60 * 1000 - (Date.now() - pendingSince) : 0;
          if (remainingMs > 0) {
            upgradePollInterval = setInterval(async () => {
              try {
                const freshInfo = await getUserInfo(HOSTED_CONFIG.backend_url, stored.token);
                if (freshInfo.tier === 'standard' || freshInfo.tier === 'pro') {
                  clearInterval(upgradePollInterval);
                  upgradePollInterval = null;
                  chrome.storage.local.remove('quorum_upgrade_pending');
                  setAuth((prev) => ({ ...prev, user: { ...prev.user, tier: freshInfo.tier } }));
                  setUsageInfo(freshInfo.usage);
                }
              } catch {
                // ignore transient errors during polling
              }
            }, 3000);
            setTimeout(() => {
              if (upgradePollInterval) {
                clearInterval(upgradePollInterval);
                upgradePollInterval = null;
              }
              chrome.storage.local.remove('quorum_upgrade_pending');
            }, remainingMs);
          }
        });
      }
    });

    return () => {
      if (upgradePollInterval) clearInterval(upgradePollInterval);
    };
  }, []);

  // Clear usage info on sign out
  useEffect(() => {
    if (!auth) setUsageInfo(null);
  }, [auth]);

  // Save session state when question or image changes
  useEffect(() => {
    if (settings) {
      saveSessionState({ question, image });
    }
  }, [question, image, settings]);

  const handleAuthSuccess = (authData) => {
    setAuth(authData);
  };

  const handleSignOut = async () => {
    await signOut();
    setAuth(null);
    setUsageInfo(null);
  };

  const handleUpgrade = () => {
    setShowPlanPicker(true);
  };

  const handleSelectPlan = async (plan) => {
    setShowPlanPicker(false);
    try {
      const { checkout_url } = await createCheckoutSession(backendUrl, auth.token, plan);

      // Persist flag so we resume polling if popup is reopened before webhook fires
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ quorum_upgrade_pending: Date.now() });
      }

      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: checkout_url });
      } else {
        window.open(checkout_url, '_blank');
      }

      // Poll /auth/me while this session is still active (sidebar case)
      const pollInterval = setInterval(async () => {
        try {
          const info = await getUserInfo(backendUrl, auth.token);
          if (info.tier === 'standard' || info.tier === 'pro') {
            clearInterval(pollInterval);
            if (typeof chrome !== 'undefined' && chrome.storage) {
              chrome.storage.local.remove('quorum_upgrade_pending');
            }
            setAuth((prev) => ({ ...prev, user: { ...prev.user, tier: info.tier } }));
            setUsageInfo(info.usage);
          }
        } catch {
          // ignore transient errors during polling
        }
      }, 3000);

      // Stop polling after 10 minutes regardless
      setTimeout(() => clearInterval(pollInterval), 10 * 60 * 1000);
    } catch (err) {
      setError('Could not open upgrade page. Please try again.');
    }
  };

  const handleSettingsSaved = (newSettings) => {
    setSettings(newSettings);
    setShowSettings(false);
  };

  const handleOpenSidebar = useCallback(async () => {
    await saveSessionState({ question, image });
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'openSidePanel' }, (response) => {
        if (response?.success) {
          window.close();
        }
      });
    }
  }, [question, image]);

  const handleAsk = async () => {
    if (!question.trim() && !image) {
      setError('Please enter a question or paste an image');
      return;
    }

    const isMixedMode = settings.mixed_mode;
    const mixedModels = isMixedMode ? getMixedModelsArray(settings.mixed_model_configs) : [];
    const totalAgents = isMixedMode ? getTotalMixedAgents(settings.mixed_model_configs) : settings.n_agents;

    if (isMixedMode && mixedModels.length === 0) {
      setError('Please add at least 1 agent in mixed model settings');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setResult(null);

    try {
      setLoadingMessage(`Running ${totalAgents} agent${totalAgents !== 1 ? 's' : ''}${isMixedMode ? ' (mixed models)' : ''}...`);

      let requestBody;

      if (isMixedMode) {
        requestBody = {
          question: question.trim(),
          agreement_ratio: settings.agreement_ratio,
          max_rounds: settings.max_rounds,
          return_agent_outputs: settings.return_agent_outputs || settings.debug_mode,
          mixed_models: mixedModels,
          // api_keys not needed — backend uses Quorum's keys
        };
      } else {
        requestBody = {
          question: question.trim(),
          n_agents: settings.n_agents,
          agreement_ratio: settings.agreement_ratio,
          max_rounds: settings.max_rounds,
          model: settings.model,
          // api_key not needed — backend uses Quorum's keys
          return_agent_outputs: settings.return_agent_outputs || settings.debug_mode,
        };
      }

      if (image) {
        requestBody.image = image;
      }

      const response = await askQuestion(backendUrl, requestBody, auth?.token);

      setLoadingMessage('Checking agreement...');
      await new Promise((r) => setTimeout(r, 300));

      setResult(response);

      // Refresh usage counter after a successful ask
      getUserInfo(backendUrl, auth.token)
        .then((info) => setUsageInfo(info.usage))
        .catch(() => {});
    } catch (err) {
      // Handle auth errors
      if (err.status === 401) {
        await signOut();
        setAuth(null);
        setError('Session expired. Please sign in again.');
        return;
      }

      // Handle upgrade-required (model tier restriction)
      if (err.status === 403 && err.details?.code === 'UPGRADE_REQUIRED') {
        setError(err.message || 'This model requires a higher tier subscription.');
        setErrorDetails({ upgrade: true, ...err.details });
        return;
      }

      // Handle usage limit reached
      if (err.status === 429 && err.details?.code === 'USAGE_LIMIT_REACHED') {
        setError(err.message);
        setErrorDetails({ upgrade: true, ...err.details });
        return;
      }

      setError(err.message || 'Failed to get response');
      if (err.details) {
        setErrorDetails(err.details);
      }
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAsk();
    }
  };

  // Still initializing
  if (!settings || authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-quorum-500"></div>
      </div>
    );
  }

  // Not authenticated — show login
  if (!auth) {
    return (
      <div className="flex flex-col h-full">
        <LoginScreen onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        onSettingsClick={() => setShowSettings(true)}
        onSidebarClick={handleOpenSidebar}
        auth={auth}
        onSignOut={handleSignOut}
        onUpgrade={handleUpgrade}
      />

      {/* Plan picker overlay */}
      {showPlanPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-bubbly-lg p-5 w-full max-w-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Choose a plan</h2>
              <button
                onClick={() => setShowPlanPicker(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {auth.user?.tier === 'free' && (
              <button
                onClick={() => handleSelectPlan('standard')}
                className="w-full text-left p-3 rounded-xl border border-quorum-200 hover:bg-quorum-50 transition-colors"
              >
                <p className="text-sm font-medium text-quorum-700">Standard · $5/mo</p>
                <p className="text-xs text-gray-500 mt-0.5">200 uses/month · Mid-tier models</p>
              </button>
            )}
            <button
              onClick={() => handleSelectPlan('pro')}
              className="w-full text-left p-3 rounded-xl border border-quorum-300 bg-gradient-to-r from-quorum-50 to-quorum-100 hover:from-quorum-100 hover:to-quorum-200 transition-colors"
            >
              <p className="text-sm font-medium text-quorum-800">Pro · $15/mo</p>
              <p className="text-xs text-gray-500 mt-0.5">500 uses/month · All models</p>
            </button>
          </div>
        </div>
      )}

      {usageInfo && (
        <UsageDisplay count={usageInfo.count} limit={usageInfo.limit} tier={auth.user?.tier} />
      )}

      {showSettings ? (
        <SettingsPanel
          settings={settings}
          onSave={handleSettingsSaved}
          onCancel={() => setShowSettings(false)}
          userTier={auth.user?.tier}
        />
      ) : (
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          <QuestionInput
            value={question}
            onChange={setQuestion}
            image={image}
            onImageChange={setImage}
            onSubmit={handleAsk}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />

          {loading && <LoadingState message={loadingMessage} />}

          {error && (
            <ErrorMessage
              message={error}
              details={errorDetails}
              onDismiss={() => {
                setError(null);
                setErrorDetails(null);
              }}
              onUpgrade={errorDetails?.upgrade ? handleUpgrade : null}
            />
          )}

          {result && (
            <AnswerCard
              result={result}
              showDetails={settings.debug_mode || settings.return_agent_outputs}
            />
          )}
        </main>
      )}
    </div>
  );
}

export default App;
