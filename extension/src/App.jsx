import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import QuestionInput from './components/QuestionInput';
import AnswerCard from './components/AnswerCard';
import SettingsPanel from './components/SettingsPanel';
import LoadingState from './components/LoadingState';
import ErrorMessage from './components/ErrorMessage';
import { getSettings } from './utils/storage';
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

  // Load settings on mount
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleSettingsSaved = (newSettings) => {
    setSettings(newSettings);
    setShowSettings(false);
  };

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
      <Header onSettingsClick={() => setShowSettings(true)} />

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
            <ErrorMessage message={error} onDismiss={() => setError(null)} />
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
