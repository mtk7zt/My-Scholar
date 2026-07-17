/**
 * types/index.ts
 *
 * Shared TypeScript types used across the application.
 */

export type Mode = 'essay' | 'project' | 'programming' | 'study' | 'general';
export type Tone = 'academic' | 'professional' | 'casual' | 'technical';
export type ThemePreference = 'light' | 'dark' | 'system';
export type OcrLanguage = 'eng' | 'fra';
export type DocumentKind = 'pdf' | 'image' | 'text' | 'office' | 'archive';
export type DocumentProcessingStage =
  | 'validating' | 'reading' | 'extracting' | 'ocr' | 'normalizing'
  | 'chunking' | 'indexing' | 'ready' | 'partial' | 'cancelled' | 'error';

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
  pageNumber?: number;
  documentKind?: DocumentKind;
}

export interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  chunkCount: number;
  status: DocumentProcessingStage;
  error?: string;
  // Human-readable warning shown for partial/scanned results (not a hard failure)
  extractionWarning?: string;
  // Page-level extraction stats, populated for PDF files
  pagesExtracted?: number;
  totalPages?: number;
  processedUnits: number;
  totalUnits?: number;
  ocrLanguage: OcrLanguage;
  usedOcr: boolean;
  ocrUnits: number[];
  failedUnits: number[];
  retryable?: boolean;
  sourceFile?: File;
}

export interface ExtractionResult {
  documentKind: DocumentKind;
  text: string;
  pageCount?: number;
  imageCount?: number;
  processedUnitCount: number;
  ocrLanguage?: OcrLanguage;
  usedOcr: boolean;
  ocrUnits: number[];
  warnings: string[];
  failedUnits: number[];
  partial: boolean;
  durationMs: number;
}

export interface DocumentProgress {
  documentId: string;
  stage: DocumentProcessingStage;
  completedUnits: number;
  totalUnits?: number;
  message?: string;
}

export interface DocumentProcessingOptions {
  documentId: string;
  ocrLanguage: OcrLanguage;
  signal: AbortSignal;
  onProgress?: (progress: DocumentProgress) => void;
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
  theme: ThemePreference;
  ocrLanguage: OcrLanguage;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  documents: UploadedDocument[];
  settings: AppSettings;
  createdAt: Date;
}
