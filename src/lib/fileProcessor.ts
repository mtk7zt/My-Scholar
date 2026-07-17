/**
 * fileProcessor.ts
 *
 * Handles text extraction from all supported file formats.
 * Everything runs in the browser — no files are uploaded to any server.
 *
 * Supported formats:
 *  - PDF    → pdf.js (Mozilla's open-source PDF renderer)
 *  - DOCX   → mammoth (converts Word documents to plain text)
 *  - XLSX   → xlsx (SheetJS, reads spreadsheet data as CSV)
 *  - PPTX   → jszip (PPTX is a ZIP of XML files; we extract slide text)
 *  - ZIP    → jszip (recursively extracts text from supported files inside)
 *  - TXT / source code → FileReader API
 */

import * as XLSX from 'xlsx';
import JSZip from 'jszip';
// Vite resolves this at build time to the correct hashed asset URL (e.g. /assets/pdf.worker-abc123.mjs)
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// ---------------------------------------------------------------------------
// Typed PDF error codes
// ---------------------------------------------------------------------------

/**
 * Discriminated error codes for PDF extraction failures.
 * Each code maps to a specific, user-readable message in getPdfErrorMessage().
 */
export type PdfErrorCode =
  | 'encrypted'       // Password-protected PDF — pdf.js throws PasswordException
  | 'xfa-unsupported' // XFA/LiveCycle form — pdf.js explicitly does not support these
  | 'corrupt'         // Malformed or invalid PDF — pdf.js throws InvalidPDFException
  | 'no-text'         // PDF opened fine but every page has an empty text layer (scanned/image-only)
  | 'load-failed';    // Worker failed to initialise or dynamic import failed

export type DocumentLimitCode =
  | 'file-too-large'
  | 'pdf-page-limit'
  | 'zip-entry-limit'
  | 'zip-expanded-size-limit';

export const DOCUMENT_LIMITS = {
  maxFileSizeBytes: 25 * 1024 * 1024,
  maxDocumentsPerSession: 10,
  maxPdfPages: 500,
  maxZipEntries: 200,
  maxZipExpandedBytes: 100 * 1024 * 1024,
  pdfPageConcurrency: 4,
} as const;

export class DocumentLimitError extends Error {
  readonly code: DocumentLimitCode;

  constructor(code: DocumentLimitCode, message: string) {
    super(message);
    this.name = 'DocumentLimitError';
    this.code = code;
  }
}

export class PdfExtractionError extends Error {
  readonly code: PdfErrorCode;
  constructor(code: PdfErrorCode, detail?: string) {
    super(getPdfErrorMessage(code, detail));
    this.name = 'PdfExtractionError';
    this.code = code;
  }
}

/** Returns the user-facing message for each error code. */
function getPdfErrorMessage(code: PdfErrorCode, detail?: string): string {
  switch (code) {
    case 'encrypted':
      return 'Password-protected PDF — remove the password and re-upload';
    case 'xfa-unsupported':
      return 'XFA form PDF — export as a standard PDF and re-upload';
    case 'corrupt':
      return `Corrupt or invalid PDF${detail ? ` (${detail})` : ''} — try re-saving the file`;
    case 'no-text':
      return 'Scanned PDF — no text layer detected. Only image-based content found';
    case 'load-failed':
      return 'PDF reader failed to load — refresh the page and try again';
  }
}

/**
 * Maps pdf.js internal error class names and messages to typed PdfErrorCodes.
 * pdf.js does not export its error classes in a way that allows instanceof
 * checks after bundling, so we match on the constructor name and message text.
 */
function classifyPdfJsError(err: unknown): PdfErrorCode {
  if (err instanceof Error) {
    const name = err.constructor?.name ?? '';
    const msg  = err.message ?? '';

    if (name === 'PasswordException' || msg.toLowerCase().includes('password')) {
      return 'encrypted';
    }
    if (msg.toUpperCase().includes('XFA')) {
      return 'xfa-unsupported';
    }
    if (
      name === 'InvalidPDFException' ||
      name === 'MissingPDFException' ||
      msg.includes('Invalid PDF') ||
      msg.includes('Missing PDF')
    ) {
      return 'corrupt';
    }
  }
  return 'corrupt'; // safe fallback for unknown pdf.js errors
}

// ---------------------------------------------------------------------------
// Extraction result type
// ---------------------------------------------------------------------------

/**
 * Returned by extractPDF (and surfaced through extractFileText for PDFs).
 * A warning without an error means partial success — some pages were readable.
 */
export interface PdfExtractionResult {
  text: string;
  totalPages: number;
  pagesExtracted: number;
  // Present when extraction succeeded but with caveats (partial pages, low text)
  warning?: string;
}

// ---------------------------------------------------------------------------
// Minimum text quality threshold
// ---------------------------------------------------------------------------

/**
 * Average characters per page below which we consider the PDF to have
 * no meaningful text layer (i.e. it is likely a scanned/image-only PDF).
 */
const MIN_CHARS_PER_PAGE = 30;
const OCR_RENDER_SCALE = 2;
const OCR_MAX_CANVAS_DIMENSION = 3000;

type PdfDocument = Awaited<ReturnType<typeof import('pdfjs-dist').getDocument>['promise']>;

async function recognizePdfPage(
  pdf: PdfDocument,
  pageNum: number,
  worker: Awaited<ReturnType<typeof import('tesseract.js').createWorker>>,
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const baseViewport = page.getViewport({ scale: 1 });
  const longestSide = Math.max(baseViewport.width, baseViewport.height);
  const scale = Math.min(OCR_RENDER_SCALE, OCR_MAX_CANVAS_DIMENSION / longestSide);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas rendering is unavailable');

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  try {
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const result = await worker.recognize(canvas);
    return result.data.text.trim();
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }
}

async function extractPagesWithOcr(
  pdf: PdfDocument,
  pageNumbers: number[],
): Promise<Map<number, string>> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract',
    langPath: '/tessdata',
    gzip: true,
    cacheMethod: 'none',
  });
  const recognized = new Map<number, string>();

  try {
    for (const pageNum of pageNumbers) {
      const text = await recognizePdfPage(pdf, pageNum, worker);
      if (text) recognized.set(pageNum, text);
    }
  } finally {
    await worker.terminate();
  }

  return recognized;
}

// ---------------------------------------------------------------------------
// pdf.js module cache (Fix #2 — load once per session)
// ---------------------------------------------------------------------------

let pdfjsLibCache: typeof import('pdfjs-dist') | null = null;

async function getPdfjsLib(): Promise<typeof import('pdfjs-dist')> {
  if (pdfjsLibCache) return pdfjsLibCache;

  let lib: typeof import('pdfjs-dist');
  try {
    lib = await import('pdfjs-dist');
  } catch {
    throw new PdfExtractionError('load-failed');
  }

  // Fix #1: Vite resolves pdfWorkerUrl to the correct hashed asset path at build time.
  // This guarantees the worker is served locally — no CDN, no hardcoded path.
  lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  pdfjsLibCache = lib;
  return lib;
}

// ---------------------------------------------------------------------------
// Core PDF extractor
// ---------------------------------------------------------------------------

/**
 * Extracts text from a PDF using pdf.js.
 *
 * Reliability improvements over the previous implementation:
 *  - Typed errors: encrypted / XFA / corrupt / no-text / load-failed
 *  - Promise.allSettled: one bad page no longer kills the entire document
 *  - Partial extraction: returns whatever pages succeeded with a warning
 *  - Text quality check: detects scanned/image-only PDFs that silently return empty strings
 */
async function extractPDF(file: File): Promise<PdfExtractionResult> {
  const pdfjsLib = await getPdfjsLib(); // throws PdfExtractionError('load-failed') on failure

  const arrayBuffer = await file.arrayBuffer();

  // Open the PDF document — this is where encrypted / corrupt / XFA errors surface.
  let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (err) {
    const code = classifyPdfJsError(err);
    throw new PdfExtractionError(code, err instanceof Error ? err.message : undefined);
  }

  const totalPages = pdf.numPages;
  if (totalPages > DOCUMENT_LIMITS.maxPdfPages) {
    throw new DocumentLimitError(
      'pdf-page-limit',
      'PDF has ' + totalPages + ' pages; the session limit is ' + DOCUMENT_LIMITS.maxPdfPages + ' pages',
    );
  }
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  const results: PromiseSettledResult<{ pageNum: number; pageText: string }>[] =
    new Array(totalPages);
  let nextPageIndex = 0;

  const workers = Array.from(
    { length: Math.min(DOCUMENT_LIMITS.pdfPageConcurrency, totalPages) },
    async () => {
      while (nextPageIndex < pageNumbers.length) {
        const pageIndex = nextPageIndex++;
        const pageNum = pageNumbers[pageIndex];
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map(item => ('str' in item ? item.str : ''))
            .join(' ')
            .trim();
          results[pageIndex] = { status: 'fulfilled', value: { pageNum, pageText } };
        } catch (reason) {
          results[pageIndex] = { status: 'rejected', reason };
        }
      }
    },
  );
  await Promise.all(workers);

  // Partition into succeeded and failed pages.
  const succeeded: { pageNum: number; pageText: string }[] = [];
  const failedPageNums: number[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      succeeded.push(result.value);
    } else {
      // Extract page number from the index position (results array is ordered).
      const idx = results.indexOf(result);
      failedPageNums.push(pageNumbers[idx]);
    }
  }

  // Hard failure — not a single page could be read.
  if (succeeded.length === 0) {
    throw new PdfExtractionError('corrupt', `All ${totalPages} pages failed to render`);
  }

  const lowTextPages = succeeded
    .filter(({ pageText }) => pageText.trim().length < MIN_CHARS_PER_PAGE)
    .map(({ pageNum }) => pageNum);
  let ocrPageCount = 0;

  if (lowTextPages.length > 0) {
    try {
      const ocrText = await extractPagesWithOcr(pdf, lowTextPages);
      for (const result of succeeded) {
        const recognizedText = ocrText.get(result.pageNum);
        if (recognizedText) {
          result.pageText = recognizedText;
          ocrPageCount += 1;
        }
      }
    } catch (err) {
      throw new PdfExtractionError(
        'no-text',
        err instanceof Error ? err.message : 'OCR failed to initialize',
      );
    }
  }

  const readablePages = succeeded.filter(({ pageText }) => pageText.trim().length > 0);
  if (readablePages.length === 0) throw new PdfExtractionError('no-text');

  const fullText = readablePages
    .sort((a, b) => a.pageNum - b.pageNum)
    .map(({ pageNum, pageText }) => `\n[Page ${pageNum}]\n${pageText}`)
    .join('');
  const pagesExtracted = readablePages.length;

  const warnings: string[] = [];
  if (ocrPageCount > 0) {
    warnings.push(`OCR was used for ${ocrPageCount} scanned page${ocrPageCount > 1 ? 's' : ''}`);
  }
  if (failedPageNums.length > 0) {
    warnings.push(`${failedPageNums.length} page${failedPageNums.length > 1 ? 's' : ''} could not be read and were skipped (page${failedPageNums.length > 1 ? 's' : ''} ${failedPageNums.join(', ')})`);
  }
  const emptyPageCount = succeeded.length - readablePages.length;
  if (emptyPageCount > 0) {
    warnings.push(`${emptyPageCount} page${emptyPageCount > 1 ? 's were' : ' was'} blank or could not be recognized`);
  }
  const warning = warnings.length > 0 ? warnings.join('. ') : undefined;

  return { text: fullText, totalPages, pagesExtracted, warning };
}

/** Extracts plain text from a DOCX file using mammoth. */
async function extractDOCX(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch {
    throw new Error('Failed to extract DOCX text');
  }
}

/** Converts each sheet in an XLSX workbook to CSV text. */
async function extractXLSX(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    let text = '';
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      text += `\n[Sheet: ${sheetName}]\n${csv}`;
    });
    return text;
  } catch {
    throw new Error('Failed to extract XLSX text');
  }
}

/**
 * Extracts text from a PPTX file.
 * PPTX files are ZIP archives containing XML slide definitions.
 * We unzip and parse the <a:t> text nodes from each slide.
 */
async function extractPPTX(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    let text = '';
    const slideFiles = Object.keys(zip.files)
      .filter(name => name.match(/ppt\/slides\/slide\d+\.xml/))
      .sort();

    for (const slideName of slideFiles) {
      const slideXml = await zip.files[slideName].async('text');
      const textMatches = slideXml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
      const slideText = textMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
      const slideNum = slideName.match(/slide(\d+)/)?.[1] || '?';
      if (slideText.trim()) {
        text += `\n[Slide ${slideNum}]\n${slideText}`;
      }
    }
    return text || 'No text content found in presentation';
  } catch {
    throw new Error('Failed to extract PPTX text');
  }
}

/**
 * Extracts text from a ZIP archive by reading all text-based files inside it.
 * Useful for uploading entire codebases or project folders as a single ZIP.
 */
async function extractZIP(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    let text = '';
    const textExtensions = [
      '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.py', '.java',
      '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.html', '.css',
      '.json', '.xml', '.yaml', '.yml', '.sh', '.bash', '.sql', '.r', '.swift',
      '.kt', '.scala', '.vue', '.svelte', '.toml', '.ini', '.cfg', '.env',
    ];

    const fileEntries = Object.entries(zip.files).filter(([, f]) => !f.dir);
    if (fileEntries.length > DOCUMENT_LIMITS.maxZipEntries) {
      throw new DocumentLimitError(
        'zip-entry-limit',
        'ZIP contains ' + fileEntries.length + ' files; the session limit is ' + DOCUMENT_LIMITS.maxZipEntries,
      );
    }

    const expandedBytes = fileEntries.reduce((total, [, zipFile]) => {
      const metadata = zipFile as typeof zipFile & { _data?: { uncompressedSize?: number } };
      return total + (metadata._data?.uncompressedSize ?? 0);
    }, 0);
    if (expandedBytes > DOCUMENT_LIMITS.maxZipExpandedBytes) {
      throw new DocumentLimitError(
        'zip-expanded-size-limit',
        'Expanded ZIP content exceeds the ' + formatFileSize(DOCUMENT_LIMITS.maxZipExpandedBytes) + ' limit',
      );
    }

    for (const [name, zipFile] of fileEntries) {
      const ext = '.' + name.split('.').pop()?.toLowerCase();
      if (textExtensions.includes(ext)) {
        try {
          const content = await zipFile.async('text');
          text += `\n\n[File: ${name}]\n${content}`;
        } catch {
          // Skip binary files that can't be decoded as text
        }
      }
    }

    return text || 'No readable text files found in ZIP';
  } catch (err) {
    if (err instanceof DocumentLimitError) throw err;
    throw new Error('Failed to extract ZIP contents', { cause: err });
  }
}

/** Reads plain text and source code files using the browser's FileReader API. */
async function extractText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string || '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Unified extraction result returned by extractFileText.
 * For non-PDF files, warning/pagesExtracted/totalPages are always undefined.
 */
export interface ExtractionResult {
  text: string;
  warning?: string;
  pagesExtracted?: number;
  totalPages?: number;
}

/**
 * Routes a file to the correct extractor based on its extension.
 * Returns an ExtractionResult so callers can surface warnings and page stats.
 * Throws PdfExtractionError (typed) for PDF-specific failures.
 */
export async function extractFileText(file: File): Promise<ExtractionResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.size > DOCUMENT_LIMITS.maxFileSizeBytes) {
    throw new DocumentLimitError(
      'file-too-large',
      'File is ' + formatFileSize(file.size) + '; the limit is ' + formatFileSize(DOCUMENT_LIMITS.maxFileSizeBytes),
    );
  }

  switch (ext) {
    case 'pdf': {
      // extractPDF returns a PdfExtractionResult — pass it through directly.
      const result = await extractPDF(file);
      return result;
    }
    case 'docx':
    case 'doc':
      return { text: await extractDOCX(file) };
    case 'xlsx':
    case 'xls':
      return { text: await extractXLSX(file) };
    case 'pptx':
    case 'ppt':
      return { text: await extractPPTX(file) };
    case 'zip':
      return { text: await extractZIP(file) };
    default:
      return { text: await extractText(file) };
  }
}

/** All file extensions accepted by the upload UI. */
export const SUPPORTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls',
  '.txt', '.md', '.zip',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp',
  '.h', '.cs', '.go', '.rs', '.rb', '.php', '.html', '.css',
  '.json', '.xml', '.yaml', '.yml', '.sh', '.sql', '.r', '.swift',
  '.kt', '.scala', '.vue', '.svelte',
];

export function isFileSupported(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/** Formats a byte count into a human-readable string (e.g. "1.4 MB"). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
