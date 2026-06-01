/**
 * Header.tsx
 *
 * Top navigation bar — fully responsive for mobile and desktop.
 * On mobile: shows hamburger (sidebar toggle), logo, and profile button.
 * On desktop: also shows mode/tone/doc status badges and New Chat button.
 */

import React from 'react';
import { useStore } from '../store/useStore';

const MODE_LABELS: Record<string, string> = {
  general: 'General',
  essay: 'Essay',
  project: 'Project',
  programming: 'Code',
  study: 'Study',
};

const TONE_LABELS: Record<string, string> = {
  academic: 'Academic',
  professional: 'Professional',
  casual: 'Casual',
  technical: 'Technical',
};

export const Header: React.FC = () => {
  const { settings, sidebarOpen, setSidebarOpen, newChat, documents, profile, setSettingsOpen } = useStore();
  const readyDocs = documents.filter(d => d.status === 'ready').length;

  return (
    <header className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-slate-800 glass flex-shrink-0 z-30">
      {/* Left: hamburger + logo */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-9 h-9 rounded-xl hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all flex-shrink-0"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-white text-sm">Scholar AI</span>
        </div>
      </div>

      {/* Center: status badges (hidden on small mobile) */}
      <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-xs text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-scholar-500 flex-shrink-0"></span>
          {MODE_LABELS[settings.mode]}
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-xs text-slate-400">
          {TONE_LABELS[settings.tone]}
        </span>
        {readyDocs > 0 && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-scholar-900/50 border border-scholar-700/50 text-xs text-scholar-400">
            📎 {readyDocs} doc{readyDocs !== 1 ? 's' : ''}
          </span>
        )}
        {settings.rubricEnabled && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-900/50 border border-purple-700/50 text-xs text-purple-400">
            🎯 Rubric
          </span>
        )}
      </div>

      {/* Mobile: compact doc badge */}
      {readyDocs > 0 && (
        <span className="sm:hidden flex items-center gap-1 px-2 py-1 rounded-full bg-scholar-900/50 border border-scholar-700/50 text-xs text-scholar-400">
          📎 {readyDocs}
        </span>
      )}

      {/* Right: new chat + profile */}
      <div className="flex items-center gap-2">
        <button
          onClick={newChat}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 hover:text-white transition-all"
        >
          + New Chat
        </button>

        {/* Profile / Settings button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-scholar-600 to-purple-600 flex items-center justify-center text-lg hover:scale-105 transition-transform glow flex-shrink-0"
          title="Settings & Profile"
          aria-label="Open settings"
        >
          {profile.avatar}
        </button>
      </div>
    </header>
  );
};
