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

/** Extracts all text from a PDF file, page by page. */
async function extractPDF(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    // Use the CDN-hosted worker to avoid bundling the large worker file
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `\n[Page ${i}]\n${pageText}`;
    }
    return fullText;
  } catch (err) {
    console.error('PDF extraction error:', err);
    throw new Error('Failed to extract PDF text');
  }
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
 * Routes a file to the correct extractor based on its extension.
 * Returns the full extracted text content as a string.
 */
export async function extractFileText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'pdf':
      return extractPDF(file);
    case 'docx':
    case 'doc':
      return extractDOCX(file);
    case 'xlsx':
    case 'xls':
      return extractXLSX(file);
    case 'pptx':
    case 'ppt':
      return extractPPTX(file);
    case 'zip':
      return extractZIP(file);
    default:
      return extractText(file);
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
