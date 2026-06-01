/**
 * ApiKeyModal.tsx
 *
 * Full-screen onboarding modal shown when no Gemini API key is stored.
 * The key is saved to localStorage so the user only needs to enter it once.
 * Disappears automatically once a valid key is provided.
 * After setup, the key can be changed anytime via the Settings panel (profile button).
 */

import React, { useState } from 'react';
import { useStore } from '../store/useStore';

export const ApiKeyModal: React.FC = () => {
  const { apiKey, setApiKey } = useStore();
  const [input, setInput] = useState(apiKey);
  const [show, setShow] = useState(false);

  if (apiKey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass rounded-2xl p-6 sm:p-8 max-w-md w-full border border-scholar-500/30 mb-safe">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-scholar-500 to-purple-600 mb-4 glow">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text">Scholar AI</h1>
          <p className="text-slate-400 text-sm mt-1">Your intelligent academic assistant</p>
        </div>

        <div className="mb-5">
          <h2 className="text-base font-semibold text-white mb-2">Enter your Gemini API Key</h2>
          <p className="text-slate-400 text-sm mb-4">
            Free from{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-scholar-400 hover:text-scholar-300 underline"
            >
              Google AI Studio
            </a>
            {' '}— no credit card needed.
          </p>

          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && input.trim() && setApiKey(input.trim())}
              placeholder="AIza..."
              autoComplete="off"
              className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-scholar-500 focus:ring-1 focus:ring-scholar-500 transition-all text-sm"
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
          className="w-full py-3 rounded-xl bg-gradient-to-r from-scholar-600 to-purple-600 text-white font-semibold hover:from-scholar-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all glow text-sm"
        >
          Start Learning →
        </button>

        <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <p className="text-xs text-slate-400 text-center">
            🔒 Stored in your browser only. Change it anytime via the profile button.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {['📄 PDF & DOCX', '🔍 Smart Search', '🎯 Rubric'].map(f => (
            <div key={f} className="text-xs text-slate-500 p-2 rounded-lg bg-slate-800/30">{f}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
