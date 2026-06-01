/**
 * Sidebar.tsx
 *
 * The left panel containing three tabbed sections:
 *  - Files   — upload and manage documents; shows processing status and chunk count
 *  - Mode    — switch between Essay, Project, Programming, Study, and General modes
 *  - Rubric  — enable and customize evaluation criteria applied to every response
 *
 * Also contains the New Chat button and API key management.
 */

import React, { useRef } from 'react';
import { useStore } from '../store/useStore';
import { formatFileSize } from '../lib/fileProcessor';
import type { Mode, Tone } from '../types';

const MODES: { value: Mode; label: string; icon: string; desc: string }[] = [
  { value: 'general', label: 'General', icon: '🤖', desc: 'All-purpose assistant' },
  { value: 'essay', label: 'Essay', icon: '✍️', desc: 'Academic writing' },
  { value: 'project', label: 'Project', icon: '📊', desc: 'Project management' },
  { value: 'programming', label: 'Code', icon: '💻', desc: 'Programming help' },
  { value: 'study', label: 'Study', icon: '📚', desc: 'Learning & revision' },
];

const TONES: { value: Tone; label: string; icon: string }[] = [
  { value: 'academic', label: 'Academic', icon: '🎓' },
  { value: 'professional', label: 'Professional', icon: '💼' },
  { value: 'casual', label: 'Casual', icon: '😊' },
  { value: 'technical', label: 'Technical', icon: '⚙️' },
];

export const Sidebar: React.FC = () => {
  const {
    documents, uploadDocument, removeDocument, clearDocuments,
    settings, setMode, setTone,
    newChat, apiKey, setApiKey,
    activePanel, setActivePanel,
    sidebarOpen,
  } = useStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadDocument(file);
    }
  };

  if (!sidebarOpen) return null;

  return (
    <div className="w-72 flex-shrink-0 flex flex-col glass border-r border-slate-800 h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-scholar-500 to-purple-600 flex items-center justify-center glow">
            <span className="text-lg">🎓</span>
          </div>
          <div>
            <h1 className="font-bold text-white text-sm">Scholar AI</h1>
            <p className="text-xs text-slate-500">Gemini 2.5 Flash</p>
          </div>
        </div>
        <button
          onClick={newChat}
          className="w-full py-2 rounded-xl bg-gradient-to-r from-scholar-600 to-purple-600 text-white text-sm font-medium hover:from-scholar-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2"
        >
          <span>+</span> New Chat
        </button>
      </div>

      {/* Panel Tabs */}
      <div className="flex border-b border-slate-800">
        {[
          { id: 'files' as const, label: 'Files', icon: '📁' },
          { id: 'settings' as const, label: 'Mode', icon: '⚙️' },
          { id: 'rubric' as const, label: 'Rubric', icon: '🎯' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-all flex flex-col items-center gap-0.5 ${
              activePanel === tab.id
                ? 'text-scholar-400 border-b-2 border-scholar-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* FILES PANEL */}
        {activePanel === 'files' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Documents</span>
              {documents.length > 0 && (
                <button
                  onClick={clearDocuments}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-700 hover:border-scholar-500 rounded-xl p-4 text-center transition-all group"
            >
              <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">📂</div>
              <p className="text-xs text-slate-400 group-hover:text-slate-300">
                Click or drag files here
              </p>
              <p className="text-xs text-slate-600 mt-1">PDF, DOCX, PPTX, XLSX, TXT, ZIP, Code</p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.md,.zip,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.cs,.go,.rs,.rb,.php,.html,.css,.json,.xml,.yaml,.yml,.sh,.sql"
              onChange={e => handleFileUpload(e.target.files)}
            />

            {documents.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-slate-600">No documents uploaded yet</p>
                <p className="text-xs text-slate-700 mt-1">Upload files to enable document search</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="glass rounded-lg p-2.5 group">
                    <div className="flex items-start gap-2">
                      <span className="text-lg flex-shrink-0">
                        {doc.name.endsWith('.pdf') ? '📄' :
                         doc.name.endsWith('.docx') || doc.name.endsWith('.doc') ? '📝' :
                         doc.name.endsWith('.xlsx') || doc.name.endsWith('.xls') ? '📊' :
                         doc.name.endsWith('.pptx') || doc.name.endsWith('.ppt') ? '📑' :
                         doc.name.endsWith('.zip') ? '🗜️' : '📃'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{doc.name}</p>
                        <p className="text-xs text-slate-500">{formatFileSize(doc.size)}</p>
                        {doc.status === 'processing' && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-3 h-3 border border-scholar-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-scholar-400">Processing...</span>
                          </div>
                        )}
                        {doc.status === 'ready' && (
                          <span className="text-xs text-emerald-400">✓ {doc.chunkCount} chunks</span>
                        )}
                        {doc.status === 'error' && (
                          <span className="text-xs text-red-400">✗ {doc.error}</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeDocument(doc.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS PANEL */}
        {activePanel === 'settings' && (
          <div className="space-y-4">
            {/* Mode */}
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Mode</span>
              <div className="space-y-1.5">
                {MODES.map(mode => (
                  <button
                    key={mode.value}
                    onClick={() => setMode(mode.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                      settings.mode === mode.value
                        ? 'bg-scholar-600/30 border border-scholar-500/50 text-white'
                        : 'hover:bg-slate-800 text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    <span className="text-lg">{mode.icon}</span>
                    <div>
                      <p className="text-xs font-medium">{mode.label}</p>
                      <p className="text-xs text-slate-500">{mode.desc}</p>
                    </div>
                    {settings.mode === mode.value && (
                      <span className="ml-auto text-scholar-400 text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Writing Tone</span>
              <div className="grid grid-cols-2 gap-1.5">
                {TONES.map(tone => (
                  <button
                    key={tone.value}
                    onClick={() => setTone(tone.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${
                      settings.tone === tone.value
                        ? 'bg-purple-600/30 border border-purple-500/50 text-white'
                        : 'hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    <span>{tone.icon}</span>
                    <span>{tone.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">API Key</span>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-scholar-500"
                />
                {apiKey && (
                  <button
                    onClick={() => setApiKey('')}
                    className="text-xs text-red-400 hover:text-red-300 px-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RUBRIC PANEL */}
        {activePanel === 'rubric' && (
          <RubricPanel />
        )}
      </div>
    </div>
  );
};

const RubricPanel: React.FC = () => {
  const { settings, updateSettings, toggleRubric } = useStore();
  const rubric = settings.rubric;

  const updateCriteria = (id: string, updates: Partial<{ name: string; description: string; weight: number; enabled: boolean }>) => {
    if (!rubric) return;
    updateSettings({
      rubric: {
        ...rubric,
        criteria: rubric.criteria.map(c => c.id === id ? { ...c, ...updates } : c),
      },
    });
  };

  const addCriteria = () => {
    if (!rubric) return;
    const newCriteria = {
      id: Date.now().toString(),
      name: 'New Criterion',
      description: 'Describe what this criterion evaluates',
      weight: 10,
      enabled: true,
    };
    updateSettings({
      rubric: { ...rubric, criteria: [...rubric.criteria, newCriteria] },
    });
  };

  const removeCriteria = (id: string) => {
    if (!rubric) return;
    updateSettings({
      rubric: { ...rubric, criteria: rubric.criteria.filter(c => c.id !== id) },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rubric</span>
        <button
          onClick={toggleRubric}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            settings.rubricEnabled ? 'bg-scholar-600' : 'bg-slate-700'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            settings.rubricEnabled ? 'translate-x-4' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {!settings.rubricEnabled && (
        <div className="text-xs text-slate-500 p-3 rounded-lg bg-slate-800/50 text-center">
          Enable rubric to apply evaluation criteria to every response
        </div>
      )}

      {settings.rubricEnabled && rubric && (
        <>
          <div className="space-y-2">
            {rubric.criteria.map(criterion => (
              <div key={criterion.id} className="glass rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateCriteria(criterion.id, { enabled: !criterion.enabled })}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                      criterion.enabled
                        ? 'bg-scholar-600 border-scholar-500'
                        : 'border-slate-600'
                    }`}
                  >
                    {criterion.enabled && <span className="text-white text-xs">✓</span>}
                  </button>
                  <input
                    value={criterion.name}
                    onChange={e => updateCriteria(criterion.id, { name: e.target.value })}
                    className="flex-1 bg-transparent text-xs font-medium text-white focus:outline-none"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={criterion.weight}
                      onChange={e => updateCriteria(criterion.id, { weight: parseInt(e.target.value) || 0 })}
                      className="w-10 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-center text-white focus:outline-none"
                      min="0"
                      max="100"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                  <button
                    onClick={() => removeCriteria(criterion.id)}
                    className="text-slate-600 hover:text-red-400 text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={criterion.description}
                  onChange={e => updateCriteria(criterion.id, { description: e.target.value })}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-scholar-500 resize-none"
                  rows={2}
                />
              </div>
            ))}
          </div>

          <button
            onClick={addCriteria}
            className="w-full py-2 rounded-xl border border-dashed border-slate-700 hover:border-scholar-500 text-xs text-slate-500 hover:text-scholar-400 transition-all"
          >
            + Add Criterion
          </button>

          <div className="text-xs text-slate-600 text-center">
            Total weight: {rubric.criteria.filter(c => c.enabled).reduce((s, c) => s + c.weight, 0)}%
          </div>
        </>
      )}
    </div>
  );
};
