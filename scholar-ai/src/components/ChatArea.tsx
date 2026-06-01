/**
 * ChatArea.tsx
 *
 * The main content area of the app. Renders the message list and,
 * when no messages exist, shows a welcome screen with mode-specific
 * starter prompts that the user can click to begin a conversation.
 * Auto-scrolls to the latest message as responses stream in.
 */

import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { streamGeminiResponse } from '../lib/gemini';
import type { Mode } from '../types';

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
  const { messages, isLoading, settings, addMessage, updateMessage, apiKey, searchDocuments } = useStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStarterClick = async (prompt: string) => {
    if (!apiKey || isLoading) return;
    
    const { setIsLoading } = useStore.getState();
    
    setIsLoading(true);
    addMessage({ role: 'user', content: prompt });
    
    const retrieved = searchDocuments(prompt, 5);
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

  const modeInfo = MODE_STARTERS[settings.mode];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
            {/* Welcome */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-scholar-500 to-purple-600 mb-4 glow">
                <span className="text-4xl">{modeInfo.icon}</span>
              </div>
              <h2 className="text-2xl font-bold gradient-text mb-2">{modeInfo.title}</h2>
              <p className="text-slate-400 text-sm">
                {!apiKey
                  ? 'Enter your Gemini API key in the sidebar to get started'
                  : 'Upload documents and start asking questions'}
              </p>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {[
                { icon: '🔍', label: 'RAG Search' },
                { icon: '📄', label: 'Multi-format' },
                { icon: '🎯', label: 'Rubric System' },
                { icon: '⚡', label: 'Streaming' },
                { icon: '🔒', label: 'Private' },
              ].map(f => (
                <span key={f.label} className="glass px-3 py-1.5 rounded-full text-xs text-slate-400 flex items-center gap-1.5">
                  <span>{f.icon}</span> {f.label}
                </span>
              ))}
            </div>

            {/* Starter prompts */}
            {apiKey && (
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
          <div className="max-w-3xl mx-auto">
            {messages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm">
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
