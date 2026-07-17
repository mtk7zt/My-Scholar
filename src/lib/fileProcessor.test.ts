import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_LIMITS,
  DocumentLimitError,
  extractFileText,
} from './fileProcessor';

describe('document limits', () => {
  it('exports the complete limit contract', () => {
    expect(DOCUMENT_LIMITS).toEqual({
      maxFileSizeBytes: 25 * 1024 * 1024,
      maxDocumentsPerSession: 10,
      maxPdfPages: 500,
      maxZipEntries: 200,
      maxZipExpandedBytes: 100 * 1024 * 1024,
      pdfPageConcurrency: 4,
      maxOcrPages: 50,
      maxOcrPixels: 16_000_000,
      maxOcrDimension: 3000,
      ocrPageTimeoutMs: 45_000,
      ocrDocumentTimeoutMs: 10 * 60_000,
    });
  });

  it('rejects a file larger than the configured maximum before parsing', async () => {
    const oversizedFile = {
      name: 'oversized.txt',
      size: DOCUMENT_LIMITS.maxFileSizeBytes + 1,
    } as File;

    await expect(extractFileText(oversizedFile)).rejects.toMatchObject({
      name: 'DocumentLimitError',
      code: 'file-too-large',
    } satisfies Partial<DocumentLimitError>);
  });
});
