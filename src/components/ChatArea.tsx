/**
 * ChatArea.tsx
 *
 * Main chat content area. Fully mobile-responsive.
 * - Shows welcome screen with starter prompts when no messages exist
 * - After a file is uploaded, shows smart question suggestion chips
 *   that the user can tap (single or multi-select) to ask instantly
 * - Auto-scrolls to the latest message as responses stream in
 */

import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { streamGeminiResponse } from '../lib/gemini';
import type { Mode } from '../types';
import { ensureDocumentSharingConsent } from '../lib/privacy';

const MODE_STARTERS: Record<Mode | 'general', { icon: string; title: string; prompts: string[] }> = {
  general: {
    icon: '🤖',
    title: 'Scholar AI',
    prompts: [
      'Summarize the uploaded document',
      'Help me research a topic',
      'Explain a complex concept',
      'Review my writing',
    ],
  },
  essay: {
    icon: '✍️',
    title: 'Essay Mode',
    prompts: [
      'Write an essay outline on climate change',
      'Help me craft a strong thesis statement',
      'Review my essay introduction',
      'Suggest transitions between paragraphs',
    ],
  },
  project: {
    icon: '📊',
    title: 'Project Mode',
    prompts: [
      'Create a project plan for a mobile app',
      'Generate a risk assessment matrix',
      'Write a project status report',
      'Break down this project into sprints',
    ],
  },
  programming: {
    icon: '💻',
    title: 'Programming Mode',
    prompts: [
      'Review my code for bugs',
      'Explain this algorithm',
      'Write unit tests for my function',
      'Suggest design patterns for this problem',
    ],
  },
  study: {
    icon: '📚',
    title: 'Study Mode',
    prompts: [
      'Create flashcards from my notes',
      'Generate practice questions',
      'Explain this concept simply',
      'Create a study schedule',
    ],
  },
};

export const ChatArea: React.FC = () => {
  const {
    messages, isLoading, settings, addMessage, updateMessage,
    apiKey, searchDocuments, suggestions, setSuggestions, documents,
    documentSharingConsent, grantDocumentSharingConsent,
  } = useStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const runPrompt = async (prompt: string) => {
    if (!apiKey || isLoading) return;

    const retrieved = searchDocuments(prompt, 5);
    if (retrieved.length > 0 && !ensureDocumentSharingConsent(documentSharingConsent, grantDocumentSharingConsent)) return;

    const { setIsLoading } = useStore.getState();
    setIsLoading(true);
    addMessage({ role: 'user', content: prompt });

    const retrievedContext = retrieved.length > 0
      ? retrieved.map(r => `[From: ${r.chunk.documentName}]\n${r.chunk.content}`).join('\n\n---\n\n')
      : '';

    const assistantId = addMessage({
      role: 'assistant',
      content: '',
      streaming: true,
      retrievedChunks: retrieved,
    });

    try {
      let fullContent = '';
      const rubricCriteria = settings.rubricEnabled && settings.rubric ? settings.rubric.criteria : [];

      for await (const chunk of streamGeminiResponse(
        [{ role: 'user', parts: [{ text: prompt }] }],
        settings.mode,
        settings.tone,
        rubricCriteria,
        retrievedContext,
        apiKey
      )) {
        fullContent += chunk;
        updateMessage(assistantId, { content: fullContent, streaming: true });
      }
      updateMessage(assistantId, { content: fullContent, streaming: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error';
      updateMessage(assistantId, { content: `❌ **Error:** ${errorMsg}`, streaming: false });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStarterClick = (prompt: string) => runPrompt(prompt);

  /** Toggle a suggestion chip on/off */
  const toggleSuggestion = (s: string) => {
    setSelectedSuggestions(prev => {
      const next = new Set([...prev].filter(item => suggestions.includes(item)));
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  /** Send all selected suggestions as one combined question */
  const sendSelectedSuggestions = async () => {
    const activeSelections = suggestions.filter(item => selectedSuggestions.has(item));
    if (activeSelections.length === 0) return;
    const combined = activeSelections.join('\n\n');
    setSuggestions([]);
    setSelectedSuggestions(new Set());
    await runPrompt(combined);
  };

  const modeInfo = MODE_STARTERS[settings.mode];
  const readyDocs = documents.filter(d => d.status === 'ready').length;
  const selectedSuggestionCount = suggestions.filter(item => selectedSuggestions.has(item)).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto px-2">
            {/* Welcome */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-scholar-500 to-purple-600 mb-4 glow">
                <span className="text-3xl sm:text-4xl">{modeInfo.icon}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold gradient-text mb-2">{modeInfo.title}</h2>
              <p className="text-slate-400 text-sm">
                {!apiKey
                  ? 'Tap the profile button (top right) to enter your Gemini API key'
                  : readyDocs > 0
                  ? `${readyDocs} document${readyDocs > 1 ? 's' : ''} loaded — ask anything below`
                  : 'Upload documents from the sidebar, then ask questions'}
              </p>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {[
                { icon: '🔍', label: 'RAG Search' },
                { icon: '📄', label: 'Multi-format' },
                { icon: '🎯', label: 'Rubric' },
                { icon: '⚡', label: 'Streaming' },
                { icon: '🔒', label: 'Local parsing' },
              ].map(f => (
                <span key={f.label} className="glass px-2.5 py-1 rounded-full text-xs text-slate-400 flex items-center gap-1">
                  <span>{f.icon}</span> {f.label}
                </span>
              ))}
            </div>

            {/* Smart suggestions after file upload */}
            {apiKey && suggestions.length > 0 && (
              <div className="w-full max-w-lg mb-4">
                <p className="text-xs text-slate-400 mb-2 text-center">
                  📎 File ready — tap questions to select, then send:
                </p>
                <div className="flex flex-wrap gap-2 justify-center mb-3">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleSuggestion(s)}
                      className={`px-3 py-2 rounded-xl text-xs text-left transition-all border ${
                        selectedSuggestions.has(s)
                          ? 'bg-scholar-600/40 border-scholar-500 text-white'
                          : 'glass border-slate-700 text-slate-400 hover:border-scholar-500/50 hover:text-white'
                      }`}
                    >
                      {selectedSuggestions.has(s) ? '✓ ' : ''}{s}
                    </button>
                  ))}
                </div>
                {selectedSuggestionCount > 0 && (
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={sendSelectedSuggestions}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-scholar-600 to-purple-600 text-white text-sm font-medium hover:from-scholar-500 hover:to-purple-500 transition-all glow"
                    >
                      Ask {selectedSuggestionCount > 1 ? `${selectedSuggestionCount} questions` : 'question'} →
                    </button>
                    <button
                      onClick={() => setSelectedSuggestions(new Set())}
                      className="px-3 py-2 rounded-xl glass border border-slate-700 text-slate-400 text-xs hover:text-white transition-all"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Starter prompts (when no file uploaded) */}
            {apiKey && suggestions.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {modeInfo.prompts.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => handleStarterClick(prompt)}
                    className="glass hover:border-scholar-500/50 rounded-xl p-3 text-left text-sm text-slate-400 hover:text-white transition-all group"
                  >
                    <span className="group-hover:text-scholar-400 transition-colors">→</span> {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full">
            {messages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm flex-shrink-0">
                  🎓
                </div>
                <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 bg-scholar-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-scholar-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-scholar-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput />
    </div>
  );
};
