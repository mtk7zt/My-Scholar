/**
 * useStore.ts
 *
 * Global application state managed with Zustand.
 * All document data, chat messages, and settings live here in memory —
 * nothing is persisted to a database or server. The profile is saved to
 * localStorage; the Gemini API key is session-only unless the user opts in.
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
import { DOCUMENT_LIMITS, extractFileText } from '../lib/fileProcessor';
import { v4 as uuidv4 } from 'uuid';

export interface UserProfile {
  name: string;
  avatar: string; // emoji avatar
}

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
  uploadError: string | null;
  clearUploadError: () => void;

  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  setMode: (mode: Mode) => void;
  setTone: (tone: Tone) => void;
  setRubric: (rubric: Rubric | null) => void;
  toggleRubric: () => void;

  // Profile
  profile: UserProfile;
  setProfile: (p: Partial<UserProfile>) => void;

  // API key (session memory by default; optional localStorage persistence)
  apiKey: string;
  apiKeyRemembered: boolean;
  setApiKey: (key: string, remember?: boolean) => void;
  forgetApiKey: () => void;

  // Session-only consent for sending retrieved document excerpts to Gemini
  documentSharingConsent: boolean;
  grantDocumentSharingConsent: () => void;

  // UI state
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  activePanel: 'files' | 'settings' | 'rubric';
  setActivePanel: (p: 'files' | 'settings' | 'rubric') => void;

  // Smart suggestions after file upload
  suggestions: string[];
  setSuggestions: (s: string[]) => void;

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

const savedProfile = localStorage.getItem('scholar_profile');
// Legacy persisted keys are treated as previously remembered.
const rememberedApiKey = localStorage.getItem('scholar_api_key') || '';
const DEFAULT_PROFILE: UserProfile = savedProfile
  ? JSON.parse(savedProfile)
  : { name: 'Student', avatar: '🎓' };

export const useStore = create<Store>((set, get) => ({
  messages: [],
  documents: [],
  chunks: [],
  settings: DEFAULT_SETTINGS,
  apiKey: rememberedApiKey,
  apiKeyRemembered: Boolean(rememberedApiKey),
  documentSharingConsent: false,
  profile: DEFAULT_PROFILE,
  isLoading: false,
  sidebarOpen: true,
  settingsOpen: false,
  activePanel: 'files',
  suggestions: [],
  uploadError: null,

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
    if (get().documents.length >= DOCUMENT_LIMITS.maxDocumentsPerSession) {
      set({ uploadError: 'A session can contain up to ' + DOCUMENT_LIMITS.maxDocumentsPerSession + ' documents' });
      return;
    }
    set({ uploadError: null });
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
      const result = await extractFileText(file);
      const textChunks = chunkText(result.text, 400, 80);

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
        documents: state.documents.map(d => {
          if (d.id !== docId) return d;
          // Partial extraction: some pages succeeded, some failed.
          // Mark as 'partial' so the UI shows a warning instead of an error.
          const status = result.warning ? 'partial' : 'ready';
          return {
            ...d,
            status,
            chunkCount: documentChunks.length,
            extractionWarning: result.warning,
            pagesExtracted: result.pagesExtracted,
            totalPages: result.totalPages,
          };
        }),
      }));

      // Generate smart suggestions based on file name and type
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const suggestions = generateSuggestions(baseName, ext);
      set({ suggestions });

    } catch (err) {
      // ── INSTRUMENTATION: full error dump ──────────────────────────────────
      // ─────────────────────────────────────────────────────────────────────

      // err.message is already user-readable from PdfExtractionError
      // or a generic message from other extractors.
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
    set({ documents: [], chunks: [], suggestions: [], uploadError: null });
  },

  clearUploadError: () => set({ uploadError: null }),

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
      .filter(r => r.score > 0.01);
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

  setProfile: (p) => {
    set(state => {
      const updated = { ...state.profile, ...p };
      localStorage.setItem('scholar_profile', JSON.stringify(updated));
      return { profile: updated };
    });
  },

  setApiKey: (key, remember = false) => {
    if (remember && key) localStorage.setItem('scholar_api_key', key);
    else localStorage.removeItem('scholar_api_key');
    set({ apiKey: key, apiKeyRemembered: remember && Boolean(key) });
  },

  forgetApiKey: () => {
    localStorage.removeItem('scholar_api_key');
    set({ apiKey: '', apiKeyRemembered: false });
  },

  grantDocumentSharingConsent: () => set({ documentSharingConsent: true }),

  setIsLoading: (v) => set({ isLoading: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setActivePanel: (p) => set({ activePanel: p }),
  setSuggestions: (s) => set({ suggestions: s }),

  /** Resets the entire session — clears messages, documents, and embeddings. */
  newChat: () => {
    resetEmbeddingState();
    set({ messages: [], documents: [], chunks: [], isLoading: false, suggestions: [] });
  },
}));

/** Generates context-aware question suggestions based on the uploaded file. */
function generateSuggestions(fileName: string, ext: string): string[] {
  const docSuggestions: Record<string, string[]> = {
    pdf: [
      `Summarize the key points of "${fileName}"`,
      `What are the main conclusions in this document?`,
      `List the most important facts from this file`,
      `Create study notes from this document`,
    ],
    docx: [
      `Summarize "${fileName}"`,
      `What is the main argument of this document?`,
      `Identify key themes and topics`,
      `Suggest improvements to this writing`,
    ],
    xlsx: [
      `Analyze the data in "${fileName}"`,
      `What trends can you identify in this spreadsheet?`,
      `Summarize the key statistics`,
      `What insights can be drawn from this data?`,
    ],
    pptx: [
      `Summarize the presentation "${fileName}"`,
      `What are the key takeaways from these slides?`,
      `Create speaker notes for this presentation`,
      `What questions might an audience ask?`,
    ],
    py: [
      `Explain what this code does`,
      `Review "${fileName}" for bugs or improvements`,
      `Write unit tests for this code`,
      `Optimize this code for performance`,
    ],
    js: [
      `Explain what this JavaScript code does`,
      `Review "${fileName}" for bugs`,
      `How can this code be improved?`,
      `Write tests for this code`,
    ],
    ts: [
      `Explain this TypeScript code`,
      `Review "${fileName}" for type safety issues`,
      `Suggest refactoring improvements`,
      `Write unit tests for this module`,
    ],
  };

  return docSuggestions[ext] || [
    `Summarize "${fileName}"`,
    `What are the key points in this file?`,
    `Explain the main concepts`,
    `Create a structured outline of this content`,
  ];
}
