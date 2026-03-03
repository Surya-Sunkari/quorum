import React from 'react';
import { Link } from 'react-router-dom';

const EXTENSION_URL = import.meta.env.VITE_CHROME_EXTENSION_URL || '#';

const features = [
  {
    title: 'When they agree, you know',
    body: 'Each agent answers on its own, without seeing the others. If most land on the same answer, that agreement is the signal.',
  },
  {
    title: 'Mix and match models',
    body: 'OpenAI, Anthropic, and Gemini all work together. Run one model or combine several in the same session.',
  },
  {
    title: 'Drop in a screenshot',
    body: 'Copy a screenshot and paste it straight into the extension. All three providers support image input.',
  },
];

function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-20">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 max-w-xl leading-tight">
          Ask once.<br />
          <span className="text-quorum-500">Hear from many.</span>
        </h1>
        <p className="mt-5 text-lg text-gray-500 max-w-md">
          Send your question to multiple AI models at once. Get back the answer they all agree on.
        </p>
        <div className="mt-10 flex items-center gap-3 flex-wrap justify-center">
          <a
            href={EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-quorum-500 text-white rounded-xl font-medium text-sm hover:bg-quorum-600 shadow-bubbly transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            Add to Chrome, it's free
          </a>
          <Link
            to="/pricing"
            className="px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 shadow-sm transition-all"
          >
            See plans
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto w-full px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl shadow-bubbly p-6 space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto w-full px-6 pb-28">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-8 text-center">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', heading: 'Type your question', detail: 'Plain text works fine. You can also paste a screenshot if the question lives in an image.' },
            { step: '02', heading: 'Agents answer in parallel', detail: 'Multiple models read the same prompt and respond on their own, without seeing each other.' },
            { step: '03', heading: 'You get the consensus', detail: 'An arbiter checks where the answers overlap and returns the one with the most agreement.' },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <span className="text-2xl font-bold text-quorum-200 tabular-nums leading-none mt-0.5">{item.step}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.heading}</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-quorum-500 py-14 px-6 text-center">
        <p className="text-white font-semibold text-xl">Free to start. No card required.</p>
        <p className="text-quorum-200 text-sm mt-2">20 uses a month on the free plan. Upgrade whenever you want more.</p>
        <a
          href={EXTENSION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-white text-quorum-600 rounded-xl font-medium text-sm hover:bg-quorum-50 shadow-bubbly-lg transition-all"
        >
          Add to Chrome
        </a>
      </section>
    </div>
  );
}

export default Home;
