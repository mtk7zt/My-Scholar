/**
 * embeddings.ts
 *
 * Client-side document embedding and retrieval using TF-IDF (Term Frequency–Inverse
 * Document Frequency) with cosine similarity. This runs entirely in the browser —
 * no external embedding API is needed, keeping the app free and private.
 *
 * How it works:
 *  1. Uploaded documents are split into overlapping text chunks.
 *  2. Each chunk is converted into a numeric vector using TF-IDF weights.
 *  3. When the user sends a message, the query is embedded the same way.
 *  4. Cosine similarity ranks chunks by relevance to the query.
 *  5. The top-k chunks are injected into the Gemini prompt as context (RAG).
 */

/** Lowercases and tokenizes a string into individual words. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

/** Common English words that carry no semantic meaning and are excluded from vectors. */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
  'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who',
  'boy', 'did', 'man', 'end', 'put', 'say', 'she', 'too', 'use', 'that',
  'this', 'with', 'have', 'from', 'they', 'will', 'been', 'more', 'when',
  'than', 'then', 'some', 'what', 'into', 'also', 'each', 'which', 'their',
  'there', 'would', 'about', 'could', 'other', 'these', 'those', 'after',
  'being', 'where', 'while', 'should', 'through', 'during', 'before',
]);

function filterStopWords(tokens: string[]): string[] {
  return tokens.filter(t => !STOP_WORDS.has(t));
}

// Global vocabulary shared across all uploaded documents in the session.
// Resets when the user starts a new chat.
let globalVocabulary: Map<string, number> = new Map();
let documentFrequency: Map<string, number> = new Map();
let totalDocuments = 0;

/** Clears all embedding state — called on New Chat or session reset. */
export function resetEmbeddingState() {
  globalVocabulary = new Map();
  documentFrequency = new Map();
  totalDocuments = 0;
}

/**
 * Adds a batch of text chunks to the global vocabulary and updates
 * document frequency counts used for IDF calculation.
 */
export function updateVocabulary(texts: string[]) {
  totalDocuments += texts.length;

  texts.forEach(text => {
    const tokens = new Set(filterStopWords(tokenize(text)));
    tokens.forEach(token => {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    });
  });

  // Assign a stable index to each new term in the vocabulary
  let idx = globalVocabulary.size;
  documentFrequency.forEach((_, term) => {
    if (!globalVocabulary.has(term)) {
      globalVocabulary.set(term, idx++);
    }
  });
}

/**
 * Converts a text string into a TF-IDF weighted vector, then L2-normalizes it.
 * Vectors are capped at 512 dimensions for memory efficiency.
 */
export function generateEmbedding(text: string): number[] {
  const tokens = filterStopWords(tokenize(text));
  const termFreq: Map<string, number> = new Map();

  tokens.forEach(token => {
    termFreq.set(token, (termFreq.get(token) || 0) + 1);
  });

  const vocabSize = Math.max(globalVocabulary.size, 1);
  const vector = new Array(Math.min(vocabSize, 512)).fill(0);

  termFreq.forEach((freq, term) => {
    const idx = globalVocabulary.get(term);
    if (idx !== undefined && idx < 512) {
      const tf = freq / tokens.length;
      const df = documentFrequency.get(term) || 1;
      // Smoothed IDF prevents division by zero and reduces bias toward rare terms
      const idf = Math.log((totalDocuments + 1) / (df + 1)) + 1;
      vector[idx] = tf * idf;
    }
  });

  // L2 normalization makes cosine similarity equivalent to dot product
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    return vector.map(v => v / norm);
  }
  return vector;
}

/**
 * Computes cosine similarity between two embedding vectors.
 * Returns a value between 0 (unrelated) and 1 (identical meaning).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    const minLen = Math.min(a.length, b.length);
    a = a.slice(0, minLen);
    b = b.slice(0, minLen);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Splits a long text into overlapping word-based chunks.
 * Overlap ensures context is not lost at chunk boundaries.
 *
 * @param text      - The full document text to split
 * @param chunkSize - Number of words per chunk (default: 500)
 * @param overlap   - Number of words shared between adjacent chunks (default: 100)
 */
export function chunkText(text: string, chunkSize = 500, overlap = 100): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  if (words.length === 0) return chunks;

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(' ');
    if (chunk.trim().length > 20) {
      chunks.push(chunk.trim());
    }
    if (end >= words.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}
