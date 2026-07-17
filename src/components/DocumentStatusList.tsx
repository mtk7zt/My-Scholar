import { useStore } from '../store/useStore';

const terminal = new Set(['ready', 'partial', 'cancelled', 'error']);

export function DocumentStatusList({ compact = false }: { compact?: boolean }) {
  const { documents, retryDocument, cancelDocument, removeDocument } = useStore();
  if (documents.length === 0) return null;
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'} aria-live="polite" aria-label="Document processing status">
      {documents.map(doc => (
        <div key={doc.id} id={`document-${doc.id}`} tabIndex={-1} className="document-status-row glass rounded-xl px-3 py-2 text-xs">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate font-medium text-theme">{doc.name}</span>
                <span className="text-theme-muted">{doc.type || 'document'} · {doc.ocrLanguage === 'fra' ? 'French' : 'English'}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-theme-muted">
                <span className={doc.status === 'error' ? 'text-red-400' : doc.status === 'partial' ? 'text-amber-400' : 'text-scholar-400'}>{doc.status === 'ocr' ? 'OCR processing' : doc.status}</span>
                {doc.totalUnits ? <span>{doc.processedUnits}/{doc.totalUnits}</span> : null}
                {doc.usedOcr ? <span>OCR used</span> : null}
                {doc.extractionWarning ? <span className="text-amber-400">Partial result</span> : null}
              </div>
              {doc.error ? <p role="alert" className="mt-1 text-red-400">{doc.error}</p> : null}
              {!terminal.has(doc.status) && doc.totalUnits ? <progress className="mt-1.5 w-full" max={doc.totalUnits} value={doc.processedUnits} aria-label={`${doc.name} progress`} /> : null}
            </div>
            <div className="flex shrink-0 gap-1">
              {!terminal.has(doc.status) ? <button className="touch-action" onClick={() => cancelDocument(doc.id)} aria-label={`Cancel ${doc.name}`}>Cancel</button> : null}
              {(doc.status === 'error' || doc.status === 'cancelled' || doc.status === 'partial') && doc.retryable ? <button className="touch-action" onClick={() => retryDocument(doc.id)} aria-label={`Retry ${doc.name}`}>Retry</button> : null}
              <button className="touch-action" onClick={() => removeDocument(doc.id)} aria-label={`Remove ${doc.name}`}>Remove</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
