import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/fileProcessor', () => ({
  DOCUMENT_LIMITS: { maxDocumentsPerSession: 10 },
  extractFileText: vi.fn(),
}));
vi.mock('../lib/embeddings', () => ({
  generateEmbedding: vi.fn(() => []),
  cosineSimilarity: vi.fn(() => 0),
  chunkText: vi.fn(() => []),
  updateVocabulary: vi.fn(),
  resetEmbeddingState: vi.fn(),
}));
vi.mock('uuid', () => ({ v4: () => 'test-id' }));

async function loadStore() {
  vi.resetModules();
  return (await import('./useStore')).useStore;
}

describe('API key storage', () => {
  beforeEach(() => localStorage.clear());

  it('migrates an existing localStorage key as remembered', async () => {
    localStorage.setItem('scholar_api_key', 'legacy-key');
    const store = await loadStore();

    expect(store.getState().apiKey).toBe('legacy-key');
    expect(store.getState().apiKeyRemembered).toBe(true);
  });

  it('keeps new keys session-only by default', async () => {
    const store = await loadStore();
    store.getState().setApiKey('session-key');

    expect(store.getState().apiKey).toBe('session-key');
    expect(store.getState().apiKeyRemembered).toBe(false);
    expect(localStorage.getItem('scholar_api_key')).toBeNull();
  });

  it('persists a key only with explicit remember opt-in', async () => {
    const store = await loadStore();
    store.getState().setApiKey('remembered-key', true);

    expect(store.getState().apiKeyRemembered).toBe(true);
    expect(localStorage.getItem('scholar_api_key')).toBe('remembered-key');
  });

  it('forgets the active key and its persisted copy', async () => {
    const store = await loadStore();
    store.getState().setApiKey('remembered-key', true);
    store.getState().forgetApiKey();

    expect(store.getState().apiKey).toBe('');
    expect(store.getState().apiKeyRemembered).toBe(false);
    expect(localStorage.getItem('scholar_api_key')).toBeNull();
  });
});

describe('document session limits', () => {
  beforeEach(() => localStorage.clear());

  it('rejects an eleventh document without mutating the document list', async () => {
    const store = await loadStore();
    const existing = Array.from({ length: 10 }, (_, index) => ({ id: String(index) }));
    store.setState({ documents: existing as never[] });

    await store.getState().uploadDocument({ name: 'extra.txt' } as File);

    expect(store.getState().documents).toHaveLength(10);
    expect(store.getState().uploadError).toContain('up to 10 documents');
  });
});
