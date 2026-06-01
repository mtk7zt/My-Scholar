/**
 * ApiKeyModal.tsx
 *
 * Full-screen onboarding modal shown when no Gemini API key is stored.
 * The key is saved to localStorage so the user only needs to enter it once.
 * Disappears automatically once a valid key is provided.
 */

import React, { useState } from 'react';
import { useStore } from '../store/useStore';

export const ApiKeyModal: React.FC = () => {
  const { apiKey, setApiKey } = useStore();
  const [input, setInput] = useState(apiKey);
  const [show, setShow] = useState(false);

  if (apiKey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="glass rounded-2xl p-8 max-w-md w-full mx-4 border border-scholar-500/30">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-scholar-500 to-purple-600 mb-4 glow">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text">Scholar AI</h1>
          <p className="text-slate-400 text-sm mt-1">Your intelligent academic assistant</p>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">Enter Gemini API Key</h2>
          <p className="text-slate-400 text-sm mb-4">
            Scholar AI uses Google's Gemini 2.5 Flash model. Get your free API key from{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-scholar-400 hover:text-scholar-300 underline"
            >
              Google AI Studio
            </a>
            .
          </p>

          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && input.trim() && setApiKey(input.trim())}
              placeholder="AIza..."
              className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-scholar-500 focus:ring-1 focus:ring-scholar-500 transition-all"
            />
            <button
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              {show ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button
          onClick={() => input.trim() && setApiKey(input.trim())}
          disabled={!input.trim()}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-scholar-600 to-purple-600 text-white font-semibold hover:from-scholar-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow"
        >
          Start Learning →
        </button>

        <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <p className="text-xs text-slate-400 text-center">
            🔒 Your API key is stored locally in your browser only. Never sent to any server.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {['📄 PDF & DOCX', '🔍 Smart Search', '🎯 Rubric System'].map(f => (
            <div key={f} className="text-xs text-slate-500 p-2 rounded-lg bg-slate-800/30">
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
