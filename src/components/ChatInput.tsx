/**
 * ChatInput.tsx
 *
 * Mobile-first message composition bar.
 * - Auto-resizing textarea (up to 5 lines)
 * - File upload via button or drag-and-drop
 * - Enter to send, Shift+Enter for new line (desktop)
 * - On mobile: send button is always visible and tappable
 * - Orchestrates the full RAG → Gemini streaming pipeline on send
 */

import React, { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { streamGeminiResponse } from '../lib/gemini';
import type { GeminiMessage } from '../lib/gemini';
import { ensureDocumentSharingConsent } from '../lib/privacy';
import { DocumentStatusList } from './DocumentStatusList';

export const ChatInput: React.FC = () => {
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    messages, addMessage, updateMessage, isLoading, setIsLoading,
    settings, apiKey, searchDocuments, uploadDocument, documents,
    documentSharingConsent, grantDocumentSharingConsent,
    uploadError, clearUploadError,
  } = useStore();

  const adjustHeight = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || !apiKey) return;

    // Search documents for relevant context (RAG)
    const retrieved = searchDocuments(text, 5);
    if (retrieved.length > 0 && !ensureDocumentSharingConsent(documentSharingConsent, grantDocumentSharingConsent)) return;

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    addMessage({ role: 'user', content: text });

    const retrievedContext = retrieved.length > 0
      ? retrieved.map(r => `[From: ${r.chunk.documentName}]\n${r.chunk.content}`).join('\n\n---\n\n')
      : '';

    // Build conversation history (last 20 messages)
    const history: GeminiMessage[] = messages
      .filter(m => !m.streaming)
      .slice(-20)
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    history.push({ role: 'user', parts: [{ text }] });

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
    // On mobile (touch devices), always use the send button
    // On desktop, Enter sends; Shift+Enter adds a new line
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 640) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    try { for (const file of Array.from(files)) await uploadDocument(file); }
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const readyDocs = documents.filter(d => d.status === 'ready').length;

  return (
    <div
      className={`border-t border-slate-800 px-3 sm:px-4 pt-3 pb-4 sm:pb-4 transition-all relative ${isDragging ? 'drop-zone-active' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-scholar-900/80 backdrop-blur-sm border-2 border-dashed border-scholar-500 rounded-xl m-2">
          <div className="text-center">
            <div className="text-4xl mb-2">📂</div>
            <p className="text-scholar-300 font-medium text-sm">Drop files to upload</p>
          </div>
        </div>
      )}

      <div className="mb-2 sm:hidden"><DocumentStatusList compact /></div>
      {/* Document indicator */}
      {uploadError && (
        <div role='alert' className='mb-2 flex items-start justify-between gap-2 rounded-lg border border-red-800/50 bg-red-900/20 px-3 py-2 text-xs text-red-300'>
          <span>{uploadError}</span>
          <button onClick={clearUploadError} aria-label='Dismiss upload error'>×</button>
        </div>
      )}

      {readyDocs > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-xs text-scholar-400">
            📎 {readyDocs} doc{readyDocs !== 1 ? 's' : ''} loaded
          </span>
          <span className="text-xs text-slate-600">· Searching automatically</span>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* File upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          title="Upload files"
          aria-label="Upload files"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.md,.zip,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.cs,.go,.rs,.rb,.php,.html,.css,.json,.xml,.yaml,.yml,.sh,.sql"
          onChange={e => handleFileUpload(e.target.files)}
        />

        {/* Textarea */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); adjustHeight(); }}
            onKeyDown={handleKeyDown}
            placeholder={
              !apiKey
                ? 'Tap the profile button to enter your API key...'
                : isLoading
                ? 'Scholar AI is thinking...'
                : 'Ask anything...'
            }
            disabled={isLoading || !apiKey}
            rows={1}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 sm:px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-scholar-500 focus:ring-1 focus:ring-scholar-500 resize-none transition-all text-sm leading-relaxed disabled:opacity-50"
            style={{ minHeight: '44px' }}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading || !apiKey}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-scholar-600 to-purple-600 hover:from-scholar-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all glow"
          aria-label="Send message"
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

      <p className="text-xs text-slate-700 text-center mt-2 hidden sm:block">
        Files are parsed locally · Prompts and consented excerpts are sent to Google Gemini
      </p>
    </div>
  );
};
