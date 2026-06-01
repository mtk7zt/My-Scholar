/**
 * ChatInput.tsx
 *
 * The message composition bar at the bottom of the chat.
 * Handles text input, file uploads (click or drag-and-drop), and
 * orchestrates the full RAG → Gemini streaming pipeline on send:
 *
 *  1. Search uploaded documents for relevant chunks
 *  2. Build conversation history for the Gemini API
 *  3. Stream the response token-by-token into the message store
 */

import React, { useState, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { streamGeminiResponse } from '../lib/gemini';
import type { GeminiMessage } from '../lib/gemini';

export const ChatInput: React.FC = () => {
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    messages, addMessage, updateMessage, isLoading, setIsLoading,
    settings, apiKey, searchDocuments, uploadDocument, documents,
  } = useStore();

  const adjustHeight = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || !apiKey) return;

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    // Add user message
    addMessage({ role: 'user', content: text });

    // Search documents for relevant context
    const retrieved = searchDocuments(text, 5);
    const retrievedContext = retrieved.length > 0
      ? retrieved.map(r => `[From: ${r.chunk.documentName}]\n${r.chunk.content}`).join('\n\n---\n\n')
      : '';

    // Build conversation history for Gemini
    const history: GeminiMessage[] = messages
      .filter(m => !m.streaming)
      .slice(-20) // Last 20 messages for context
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    // Add current user message
    history.push({ role: 'user', parts: [{ text }] });

    // Add assistant message placeholder
    const assistantId = addMessage({
      role: 'assistant',
      content: '',
      streaming: true,
      retrievedChunks: retrieved,
    });

    try {
      let fullContent = '';
      const rubricCriteria = settings.rubricEnabled && settings.rubric
        ? settings.rubric.criteria
        : [];

      for await (const chunk of streamGeminiResponse(
        history,
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
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      updateMessage(assistantId, {
        content: `❌ **Error:** ${errorMsg}\n\nPlease check your API key and try again.`,
        streaming: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await uploadDocument(file);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFileUpload(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  return (
    <div
      className={`border-t border-slate-800 p-4 transition-all ${isDragging ? 'drop-zone-active' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-scholar-900/80 backdrop-blur-sm rounded-xl border-2 border-dashed border-scholar-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📂</div>
            <p className="text-scholar-300 font-medium">Drop files to upload</p>
          </div>
        </div>
      )}

      {/* Document count indicator */}
      {documents.length > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-xs text-scholar-400">
            📎 {documents.filter(d => d.status === 'ready').length} document{documents.filter(d => d.status === 'ready').length !== 1 ? 's' : ''} loaded
          </span>
          <span className="text-xs text-slate-600">· Searching automatically</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          title="Upload files"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.md,.zip,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.cs,.go,.rs,.rb,.php,.html,.css,.json,.xml,.yaml,.yml,.sh,.sql"
          onChange={e => handleFileUpload(e.target.files)}
        />

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); adjustHeight(); }}
            onKeyDown={handleKeyDown}
            placeholder={
              !apiKey
                ? 'Enter your API key to start...'
                : isLoading
                ? 'Scholar AI is thinking...'
                : 'Ask anything... (Shift+Enter for new line)'
            }
            disabled={isLoading || !apiKey}
            rows={1}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-scholar-500 focus:ring-1 focus:ring-scholar-500 resize-none transition-all text-sm leading-relaxed disabled:opacity-50"
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || !apiKey}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-scholar-600 to-purple-600 hover:from-scholar-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all glow"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>

      <p className="text-xs text-slate-600 text-center mt-2">
        Scholar AI · Gemini 2.5 Flash · All data stays in your browser
      </p>
    </div>
  );
};
