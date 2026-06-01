/**
 * Header.tsx
 *
 * Top navigation bar showing the active mode, tone, document count,
 * and rubric status as quick-glance badges. Also contains the sidebar
 * toggle and a New Chat shortcut button.
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
  const { settings, sidebarOpen, setSidebarOpen, newChat, documents } = useStore();
  const readyDocs = documents.filter(d => d.status === 'ready').length;

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 glass flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          title="Toggle sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-lg">🎓</span>
          <span className="font-semibold text-white text-sm hidden sm:block">Scholar AI</span>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-2">
        <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-xs text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-scholar-500"></span>
          {MODE_LABELS[settings.mode]}
        </span>
        <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-xs text-slate-400">
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

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={newChat}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 hover:text-white transition-all"
        >
          + New Chat
        </button>
      </div>
    </header>
  );
};
