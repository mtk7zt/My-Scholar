/**
 * SettingsModal.tsx
 *
 * Full settings panel accessible from the header profile button.
 * Contains API key management, user profile (name + avatar),
 * mode selection, tone selection, and rubric configuration.
 * Slides in from the right on desktop, bottom sheet on mobile.
 */

import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import type { Mode, Tone } from '../types';

const AVATARS = ['🎓', '👨‍🎓', '👩‍🎓', '🧑‍💻', '👨‍💻', '👩‍💻', '🧑‍🔬', '👨‍🔬', '👩‍🔬', '🧑‍🏫', '📚', '🦊', '🐼', '🦁', '🐯'];

const MODES: { value: Mode; label: string; icon: string; desc: string }[] = [
  { value: 'general',     label: 'General',     icon: '🤖', desc: 'All-purpose assistant' },
  { value: 'essay',       label: 'Essay',       icon: '✍️', desc: 'Academic writing' },
  { value: 'project',     label: 'Project',     icon: '📊', desc: 'Project management' },
  { value: 'programming', label: 'Programming', icon: '💻', desc: 'Code & debugging' },
  { value: 'study',       label: 'Study',       icon: '📚', desc: 'Learning & revision' },
];

const TONES: { value: Tone; label: string; icon: string; desc: string }[] = [
  { value: 'academic',     label: 'Academic',     icon: '🎓', desc: 'Formal & scholarly' },
  { value: 'professional', label: 'Professional', icon: '💼', desc: 'Clear & business-ready' },
  { value: 'casual',       label: 'Casual',       icon: '😊', desc: 'Friendly & relaxed' },
  { value: 'technical',    label: 'Technical',    icon: '⚙️', desc: 'Precise & detailed' },
];

export const SettingsModal: React.FC = () => {
  const {
    settingsOpen, setSettingsOpen,
    apiKey, setApiKey,
    profile, setProfile,
    settings, setMode, setTone, toggleRubric, updateSettings,
  } = useStore();

  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState(apiKey);
  const [activeTab, setActiveTab] = useState<'profile' | 'mode' | 'tone' | 'rubric'>('profile');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  if (!settingsOpen) return null;

  const handleSaveKey = () => {
    setApiKey(keyInput.trim());
  };

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
    updateSettings({
      rubric: {
        ...rubric,
        criteria: [...rubric.criteria, {
          id: Date.now().toString(),
          name: 'New Criterion',
          description: 'Describe what this criterion evaluates',
          weight: 10,
          enabled: true,
        }],
      },
    });
  };

  const removeCriteria = (id: string) => {
    if (!rubric) return;
    updateSettings({ rubric: { ...rubric, criteria: rubric.criteria.filter(c => c.id !== id) } });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={() => setSettingsOpen(false)}
      />

      {/* Panel — right drawer on desktop, bottom sheet on mobile */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 flex flex-col glass border-l border-slate-700 shadow-2xl
                      sm:translate-x-0 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-white font-semibold text-base">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 flex-shrink-0 overflow-x-auto">
          {[
            { id: 'profile' as const, label: 'Profile', icon: '👤' },
            { id: 'mode'    as const, label: 'Mode',    icon: '🎯' },
            { id: 'tone'    as const, label: 'Tone',    icon: '✍️' },
            { id: 'rubric'  as const, label: 'Rubric',  icon: '📋' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-0 py-3 text-xs font-medium transition-all flex flex-col items-center gap-0.5 whitespace-nowrap px-2 ${
                activeTab === tab.id
                  ? 'text-scholar-400 border-b-2 border-scholar-500'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              {/* Avatar + Name */}
              <div className="flex flex-col items-center gap-3 py-4">
                <button
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-scholar-500 to-purple-600 flex items-center justify-center text-4xl glow hover:scale-105 transition-transform"
                >
                  {profile.avatar}
                </button>
                <p className="text-xs text-slate-500">Tap to change avatar</p>

                {showAvatarPicker && (
                  <div className="grid grid-cols-5 gap-2 p-3 glass rounded-xl w-full">
                    {AVATARS.map(av => (
                      <button
                        key={av}
                        onClick={() => { setProfile({ avatar: av }); setShowAvatarPicker(false); }}
                        className={`text-2xl p-2 rounded-lg hover:bg-slate-700 transition-all ${profile.avatar === av ? 'bg-scholar-600/40 ring-1 ring-scholar-500' : ''}`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>
                )}

                <div className="w-full">
                  <label className="text-xs text-slate-400 block mb-1.5">Display Name</label>
                  <input
                    value={profile.name}
                    onChange={e => setProfile({ name: e.target.value })}
                    placeholder="Your name"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-scholar-500 transition-all"
                  />
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Gemini API Key
                </label>
                <div className="relative mb-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                    placeholder="AIza..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-scholar-500 transition-all"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-sm"
                  >
                    {showKey ? '🙈' : '👁️'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveKey}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-scholar-600 to-purple-600 text-white text-xs font-medium hover:from-scholar-500 hover:to-purple-500 transition-all"
                  >
                    Save Key
                  </button>
                  {apiKey && (
                    <button
                      onClick={() => { setApiKey(''); setKeyInput(''); }}
                      className="px-4 py-2 rounded-xl bg-red-900/30 border border-red-800/50 text-red-400 text-xs hover:bg-red-900/50 transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="mt-2 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-500">
                    🔒 Stored in your browser only. Get a free key at{' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-scholar-400 underline">
                      Google AI Studio
                    </a>
                  </p>
                </div>
                {apiKey && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs text-emerald-400">API key active</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODE TAB */}
          {activeTab === 'mode' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-3">Choose how Scholar AI behaves and what it specializes in.</p>
              {MODES.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => setMode(mode.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    settings.mode === mode.value
                      ? 'bg-scholar-600/30 border border-scholar-500/50 text-white'
                      : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl">{mode.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{mode.label}</p>
                    <p className="text-xs text-slate-500">{mode.desc}</p>
                  </div>
                  {settings.mode === mode.value && (
                    <span className="text-scholar-400 text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* TONE TAB */}
          {activeTab === 'tone' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-3">Set the writing style for all responses.</p>
              {TONES.map(tone => (
                <button
                  key={tone.value}
                  onClick={() => setTone(tone.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    settings.tone === tone.value
                      ? 'bg-purple-600/30 border border-purple-500/50 text-white'
                      : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl">{tone.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{tone.label}</p>
                    <p className="text-xs text-slate-500">{tone.desc}</p>
                  </div>
                  {settings.tone === tone.value && (
                    <span className="text-purple-400 text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* RUBRIC TAB */}
          {activeTab === 'rubric' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Evaluation Rubric</p>
                  <p className="text-xs text-slate-500">Applied to every AI response</p>
                </div>
                <button
                  onClick={toggleRubric}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.rubricEnabled ? 'bg-scholar-600' : 'bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.rubricEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {!settings.rubricEnabled ? (
                <div className="text-xs text-slate-500 p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
                  Enable the rubric to have Scholar AI evaluate its own responses against your criteria.
                </div>
              ) : rubric && (
                <>
                  <div className="space-y-2">
                    {rubric.criteria.map(criterion => (
                      <div key={criterion.id} className="glass rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCriteria(criterion.id, { enabled: !criterion.enabled })}
                            className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                              criterion.enabled ? 'bg-scholar-600 border-scholar-500' : 'border-slate-600'
                            }`}
                          >
                            {criterion.enabled && <span className="text-white text-xs">✓</span>}
                          </button>
                          <input
                            value={criterion.name}
                            onChange={e => updateCriteria(criterion.id, { name: e.target.value })}
                            className="flex-1 bg-transparent text-sm font-medium text-white focus:outline-none"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={criterion.weight}
                              onChange={e => updateCriteria(criterion.id, { weight: parseInt(e.target.value) || 0 })}
                              className="w-12 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-center text-white focus:outline-none"
                              min="0" max="100"
                            />
                            <span className="text-xs text-slate-500">%</span>
                          </div>
                          <button onClick={() => removeCriteria(criterion.id)} className="text-slate-600 hover:text-red-400 text-sm transition-colors">✕</button>
                        </div>
                        <textarea
                          value={criterion.description}
                          onChange={e => updateCriteria(criterion.id, { description: e.target.value })}
                          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400 focus:outline-none focus:border-scholar-500 resize-none"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addCriteria}
                    className="w-full py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-scholar-500 text-xs text-slate-500 hover:text-scholar-400 transition-all"
                  >
                    + Add Criterion
                  </button>
                  <p className="text-xs text-slate-600 text-center">
                    Total: {rubric.criteria.filter(c => c.enabled).reduce((s, c) => s + c.weight, 0)}%
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
