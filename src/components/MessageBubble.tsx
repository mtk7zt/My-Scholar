/**
 * MessageBubble.tsx
 *
 * Renders a single chat message — either from the user or Scholar AI.
 * Assistant messages support full Markdown rendering including tables,
 * syntax-highlighted code blocks, and an animated streaming cursor.
 * Users can copy the message text or expand retrieved source chunks.
 */

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '../types';

interface Props {
  message: Message;
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === 'user';

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 mb-6 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
        isUser
          ? 'bg-gradient-to-br from-scholar-500 to-purple-600'
          : 'bg-gradient-to-br from-emerald-500 to-teal-600'
      }`}>
        {isUser ? '👤' : '🎓'}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-gradient-to-br from-scholar-600 to-purple-700 text-white rounded-tr-sm'
            : 'glass text-slate-100 rounded-tl-sm'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className={`prose prose-sm max-w-none ${message.streaming ? 'streaming-cursor' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !match;
                    return isInline ? (
                      <code
                        className="bg-slate-800 text-pink-300 px-1.5 py-0.5 rounded text-xs font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <div className="relative group my-3">
                        <div className="flex items-center justify-between bg-slate-800 rounded-t-lg px-3 py-1.5">
                          <span className="text-xs text-slate-400 font-mono">{match[1]}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(String(children));
                            }}
                            className="text-xs text-slate-400 hover:text-white transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{
                            margin: 0,
                            borderRadius: '0 0 0.5rem 0.5rem',
                            fontSize: '0.8rem',
                          }}
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    );
                  },
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-3">
                        <table className="min-w-full border-collapse text-xs">{children}</table>
                      </div>
                    );
                  },
                  th({ children }) {
                    return <th className="border border-slate-600 bg-slate-800 px-3 py-2 text-left font-semibold">{children}</th>;
                  },
                  td({ children }) {
                    return <td className="border border-slate-700 px-3 py-2">{children}</td>;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Actions row */}
        {!isUser && !message.streaming && (
          <div className="flex items-center gap-2 mt-1.5 px-1">
            <button
              onClick={copyToClipboard}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
            >
              {copied ? '✓ Copied' : '⎘ Copy'}
            </button>
            {message.retrievedChunks && message.retrievedChunks.length > 0 && (
              <button
                onClick={() => setShowSources(!showSources)}
                className="text-xs text-scholar-400 hover:text-scholar-300 transition-colors flex items-center gap-1"
              >
                📎 {message.retrievedChunks.length} source{message.retrievedChunks.length > 1 ? 's' : ''}
              </button>
            )}
            <span className="text-xs text-slate-600">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Sources panel */}
        {showSources && message.retrievedChunks && (
          <div className="mt-2 w-full space-y-2">
            {message.retrievedChunks.map((r, i) => (
              <div key={i} className="glass rounded-lg p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-scholar-400 font-medium">📄 {r.chunk.documentName}</span>
                  <span className="text-slate-500">Score: {(r.score * 100).toFixed(0)}%</span>
                </div>
                <p className="text-slate-400 line-clamp-3">{r.chunk.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
