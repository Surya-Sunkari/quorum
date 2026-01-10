import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import QuestionInput from './components/QuestionInput';
import AnswerCard from './components/AnswerCard';
import SettingsPanel from './components/SettingsPanel';
import LoadingState from './components/LoadingState';
import ErrorMessage from './components/ErrorMessage';
import { getSettings, getSessionState, saveSessionState } from './utils/storage';
import { askQuestion } from './utils/api';

function App() {
  const [settings, setSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [question, setQuestion] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);

  // Load settings and session state on mount
  useEffect(() => {
    getSettings().then(setSettings);
    getSessionState().then((session) => {
      if (session.question) setQuestion(session.question);
      if (session.image) setImage(session.image);
    });
  }, []);

  // Save session state when question or image changes
  useEffect(() => {
    if (settings) {
      saveSessionState({ question, image });
    }
  }, [question, image, settings]);

  const handleSettingsSaved = (newSettings) => {
    setSettings(newSettings);
    setShowSettings(false);
  };

  const handleOpenSidebar = useCallback(async () => {
    // Save current state before opening sidebar
    await saveSessionState({ question, image });

    // Send message to background script to open side panel
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'openSidePanel' }, (response) => {
        if (response?.success) {
          // Close the popup after opening sidebar
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

    if (!settings.api_key) {
      setError('Please configure your API key in settings');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setResult(null);

    try {
      setLoadingMessage(`Running ${settings.n_agents} agents...`);

      const requestBody = {
        question: question.trim(),
        n_agents: settings.n_agents,
        agreement_ratio: settings.agreement_ratio,
        max_rounds: settings.max_rounds,
        model: settings.model,
        api_key: settings.api_key,
        return_agent_outputs: settings.return_agent_outputs || settings.debug_mode,
      };

      if (image) {
        requestBody.image = image;
      }

      const response = await askQuestion(settings.backend_url, requestBody);

      setLoadingMessage('Checking agreement...');

      // Small delay to show the checking message
      await new Promise((r) => setTimeout(r, 300));

      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to get response');
      // Capture detailed error info if available
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

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        onSettingsClick={() => setShowSettings(true)}
        onSidebarClick={handleOpenSidebar}
      />

      {showSettings ? (
        <SettingsPanel
          settings={settings}
          onSave={handleSettingsSaved}
          onCancel={() => setShowSettings(false)}
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
