# Security Stabilization Report

## Executive summary

The root application now validates PDF/image signatures, bounds OCR and archive work, isolates untrusted document context, avoids runtime API caching, and scrubs telemetry. No critical or high production dependency advisory remains after replacing SheetJS. Two moderate ExcelJS/UUID advisories remain; the affected UUID buffer APIs are not called by Scholar AI, but the dependency must stay monitored.

## Remediated findings

### SEC-001 — High — Vulnerable spreadsheet parser

- Location: `package.json` and `src/lib/fileProcessor.ts` spreadsheet extraction.
- Evidence: the previous direct `xlsx` dependency was affected by GHSA-4r6h-8v6p-xvw6 and GHSA-5pgg-2g8v-p4x9 with no npm fix.
- Impact: a malicious workbook could trigger prototype pollution or excessive regular-expression work in the browser.
- Fix: replaced SheetJS with lazy-loaded ExcelJS and retained file/session limits.

### SEC-002 — High — File type trusted extension

- Location: `src/lib/fileProcessor.ts`, `validateFileSignature`.
- Evidence: parsing previously routed solely from the filename extension.
- Impact: a disguised file could be routed into an unintended parser.
- Fix: validate PDF, PNG, JPEG, and WebP magic bytes before decoding.

### SEC-003 — High — Unbounded OCR lifecycle

- Location: `src/lib/fileProcessor.ts`, OCR coordinator and limits.
- Evidence: the previous worker handled scans but had no abort signal, timeout, page ceiling, pixel ceiling, or single-job guard.
- Impact: malicious or unusually large scans could exhaust mobile memory or leave workers active.
- Fix: one active OCR job, sequential pages, pixel/dimension/page limits, page/document timeouts, cancellation, render cancellation, bitmap/canvas cleanup, and worker termination.

## Accepted and monitored risks

### SEC-004 — Low — Opt-in API-key persistence

- Location: `src/store/useStore.ts`, `setApiKey`.
- Evidence: a user may explicitly choose to remember their Gemini key in local storage.
- Impact: an origin-level XSS or malicious extension could read a remembered key.
- Mitigation: session-only default, explicit consent copy, removal control, restrictive CSP, no raw HTML rendering, and no key in URLs or telemetry.

### SEC-005 — Moderate — ExcelJS transitive UUID advisory

- Location: `package-lock.json`, ExcelJS transitive `uuid`.
- Evidence: npm reports GHSA-w5hq-g745-h8pq for UUID buffer-writing variants.
- Impact: bounded-buffer UUID APIs could write outside intended bounds if invoked with attacker-controlled buffers.
- Mitigation: Scholar AI does not call those APIs; CI blocks high/critical production findings and the dependency remains subject to upgrade/replacement review.

## Verified controls

- `netlify.toml` limits scripts/workers/connections and denies framing and objects.
- `vite.config.ts` has empty runtime caching and excludes OCR data and source maps from precaching.
- `tools/verify-pwa.mjs` rejects credential, Gemini, Sentry, OCR, or key-related service-worker targets.
- `src/lib/gemini.ts` sends the key in a header and labels retrieved content as untrusted context.
- `src/lib/observability.ts` removes requests, users, console/fetch breadcrumbs, and non-allowlisted metadata.
