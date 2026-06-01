/**
 * types/index.ts
 *
 * Shared TypeScript types used across the application.
 */

export type Mode = 'essay' | 'project' | 'programming' | 'study' | 'general';
export type Tone = 'academic' | 'professional' | 'casual' | 'technical';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  streaming?: boolean;
  retrievedChunks?: RetrievedChunk[];
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
}

export interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  chunkCount: number;
  // 'partial' means some pages extracted successfully but others failed or had no text
  status: 'processing' | 'ready' | 'partial' | 'error';
  error?: string;
  // Human-readable warning shown for partial/scanned results (not a hard failure)
  extractionWarning?: string;
  // Page-level extraction stats, populated for PDF files
  pagesExtracted?: number;
  totalPages?: number;
}

export interface RetrievedChunk {
  chunk: DocumentChunk;
  score: number;
}

export interface RubricCriteria {
  id: string;
  name: string;
  description: string;
  weight: number;
  enabled: boolean;
}

export interface Rubric {
  id: string;
  name: string;
  criteria: RubricCriteria[];
  enabled: boolean;
}

export interface AppSettings {
  mode: Mode;
  tone: Tone;
  rubric: Rubric | null;
  rubricEnabled: boolean;
  streamingEnabled: boolean;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  documents: UploadedDocument[];
  settings: AppSettings;
  createdAt: Date;
}
