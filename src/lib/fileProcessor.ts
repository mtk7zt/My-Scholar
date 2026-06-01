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

  // Fix #1: locally bundled worker — no CDN fetch on every upload.
  lib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

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
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Promise.allSettled — a single failing page no longer aborts the whole document.
  const results = await Promise.allSettled(
    pageNumbers.map(async (pageNum) => {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim();
      return { pageNum, pageText };
    })
  );

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

  // Assemble text in page order.
  const fullText = succeeded
    .sort((a, b) => a.pageNum - b.pageNum)
    .map(({ pageNum, pageText }) => `\n[Page ${pageNum}]\n${pageText}`)
    .join('');

  const pagesExtracted = succeeded.length;

  // Text quality check — detect scanned / image-only PDFs.
  // We only run this when ALL pages rendered (no hard failures), because
  // a partial extraction with some empty pages is a different problem.
  if (failedPageNums.length === 0) {
    const totalChars = fullText.replace(/\[Page \d+\]/g, '').trim().length;
    const avgCharsPerPage = totalChars / totalPages;

    if (avgCharsPerPage < MIN_CHARS_PER_PAGE) {
      throw new PdfExtractionError('no-text');
    }
  }

  // Build the result — attach a warning if some pages were skipped.
  const warning =
    failedPageNums.length > 0
      ? `${failedPageNums.length} page${failedPageNums.length > 1 ? 's' : ''} could not be read and were skipped (page${failedPageNums.length > 1 ? 's' : ''} ${failedPageNums.join(', ')})`
      : undefined;

  return { text: fullText, totalPages, pagesExtracted, warning };
}

/** Extracts plain text from a DOCX file using mammoth. */
async function extractDOCX(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (err) {
    console.error('DOCX extraction error:', err);
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
  } catch (err) {
    console.error('XLSX extraction error:', err);
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
  } catch (err) {
    console.error('PPTX extraction error:', err);
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
    console.error('ZIP extraction error:', err);
    throw new Error('Failed to extract ZIP contents');
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
