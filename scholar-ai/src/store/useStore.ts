/**
 * useStore.ts
 *
 * Global application state managed with Zustand.
 * All document data, chat messages, and settings live here in memory —
 * nothing is persisted to a database or server. The only exception is
 * the Gemini API key, which is saved to localStorage for convenience.
 *
 * State is fully cleared when the user clicks "New Chat" or closes the tab.
 */

import { create } from 'zustand';
import type { Message, UploadedDocument, DocumentChunk, AppSettings, Mode, Tone, Rubric, RetrievedChunk } from '../types';
import {
  generateEmbedding,
  cosineSimilarity,
  chunkText,
  updateVocabulary,
  resetEmbeddingState,
} from '../lib/embeddings';
import { extractFileText } from '../lib/fileProcessor';
import { v4 as uuidv4 } from 'uuid';

interface Store {
  // Chat
  messages: Message[];
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;

  // Documents & embeddings
  documents: UploadedDocument[];
  chunks: DocumentChunk[];
  uploadDocument: (file: File) => Promise<void>;
  removeDocument: (id: string) => void;
  clearDocuments: () => void;
  searchDocuments: (query: string, topK?: number) => RetrievedChunk[];

  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  setMode: (mode: Mode) => void;
  setTone: (tone: Tone) => void;
  setRubric: (rubric: Rubric | null) => void;
  toggleRubric: () => void;

  // API key (persisted to localStorage only)
  apiKey: string;
  setApiKey: (key: string) => void;

  // UI state
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  rubricPanelOpen: boolean;
  setRubricPanelOpen: (v: boolean) => void;
  activePanel: 'files' | 'settings' | 'rubric';
  setActivePanel: (p: 'files' | 'settings' | 'rubric') => void;

  // Session reset
  newChat: () => void;
}

/** Default rubric applied when the user first enables the rubric system. */
const DEFAULT_RUBRIC: Rubric = {
  id: 'default',
  name: 'Academic Standard',
  enabled: true,
  criteria: [
    { id: '1', name: 'Clarity',    description: 'Response is clear, well-organized, and easy to understand',          weight: 25, enabled: true },
    { id: '2', name: 'Accuracy',   description: 'Information is factually correct and well-supported',                weight: 25, enabled: true },
    { id: '3', name: 'Depth',      description: 'Response demonstrates thorough analysis and comprehensive coverage', weight: 25, enabled: true },
    { id: '4', name: 'Relevance',  description: 'Response directly addresses the question or task',                   weight: 25, enabled: true },
  ],
};

const DEFAULT_SETTINGS: AppSettings = {
  mode: 'general',
  tone: 'professional',
  rubric: DEFAULT_RUBRIC,
  rubricEnabled: false,
  streamingEnabled: true,
};

export const useStore = create<Store>((set, get) => ({
  messages: [],
  documents: [],
  chunks: [],
  settings: DEFAULT_SETTINGS,
  apiKey: localStorage.getItem('scholar_api_key') || '',
  isLoading: false,
  sidebarOpen: true,
  rubricPanelOpen: false,
  activePanel: 'files',

  addMessage: (msg) => {
    const id = uuidv4();
    const message: Message = { ...msg, id, timestamp: new Date() };
    set(state => ({ messages: [...state.messages, message] }));
    return id;
  },

  updateMessage: (id, updates) => {
    set(state => ({
      messages: state.messages.map(m => m.id === id ? { ...m, ...updates } : m),
    }));
  },

  clearMessages: () => set({ messages: [] }),

  /**
   * Processes an uploaded file:
   *  1. Extracts text using the appropriate parser
   *  2. Splits the text into overlapping chunks
   *  3. Generates TF-IDF embeddings for each chunk
   *  4. Stores chunks in memory for retrieval during chat
   */
  uploadDocument: async (file: File) => {
    const docId = uuidv4();
    const doc: UploadedDocument = {
      id: docId,
      name: file.name,
      type: file.type || file.name.split('.').pop() || 'unknown',
      size: file.size,
      uploadedAt: new Date(),
      chunkCount: 0,
      status: 'processing',
    };

    set(state => ({ documents: [...state.documents, doc] }));

    try {
      const text = await extractFileText(file);
      const textChunks = chunkText(text, 400, 80);

      // Update the shared vocabulary before generating embeddings
      updateVocabulary(textChunks);

      const documentChunks: DocumentChunk[] = textChunks.map((content, idx) => ({
        id: uuidv4(),
        documentId: docId,
        documentName: file.name,
        content,
        embedding: generateEmbedding(content),
        chunkIndex: idx,
      }));

      set(state => ({
        chunks: [...state.chunks, ...documentChunks],
        documents: state.documents.map(d =>
          d.id === docId
            ? { ...d, status: 'ready', chunkCount: documentChunks.length }
            : d
        ),
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Processing failed';
      set(state => ({
        documents: state.documents.map(d =>
          d.id === docId ? { ...d, status: 'error', error: errorMsg } : d
        ),
      }));
    }
  },

  removeDocument: (id) => {
    set(state => ({
      documents: state.documents.filter(d => d.id !== id),
      chunks: state.chunks.filter(c => c.documentId !== id),
    }));
  },

  clearDocuments: () => {
    resetEmbeddingState();
    set({ documents: [], chunks: [] });
  },

  /**
   * Searches all stored document chunks for content relevant to the query.
   * Embeds the query using the same TF-IDF method, then ranks chunks by
   * cosine similarity and returns the top-k results.
   */
  searchDocuments: (query: string, topK = 5): RetrievedChunk[] => {
    const { chunks } = get();
    if (chunks.length === 0) return [];

    const queryEmbedding = generateEmbedding(query);

    const scored = chunks.map(chunk => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter(r => r.score > 0.01); // Discard near-zero matches
  },

  updateSettings: (updates) => {
    set(state => ({ settings: { ...state.settings, ...updates } }));
  },

  setMode: (mode) => set(state => ({ settings: { ...state.settings, mode } })),
  setTone: (tone) => set(state => ({ settings: { ...state.settings, tone } })),
  setRubric: (rubric) => set(state => ({ settings: { ...state.settings, rubric } })),
  toggleRubric: () => set(state => ({
    settings: { ...state.settings, rubricEnabled: !state.settings.rubricEnabled },
  })),

  setApiKey: (key) => {
    localStorage.setItem('scholar_api_key', key);
    set({ apiKey: key });
  },

  setIsLoading: (v) => set({ isLoading: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setRubricPanelOpen: (v) => set({ rubricPanelOpen: v }),
  setActivePanel: (p) => set({ activePanel: p }),

  /** Resets the entire session — clears messages, documents, and embeddings. */
  newChat: () => {
    resetEmbeddingState();
    set({ messages: [], documents: [], chunks: [], isLoading: false });
  },
}));
