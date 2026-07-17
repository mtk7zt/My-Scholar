# Assessment and Roadmap Alignment

## Purpose

This document records the verified product baseline, canonical deployment decision, approved roadmap direction, scope boundaries, and release procedure for the root Scholar AI application. Product planning and release decisions must refer to the code that is actually built.

## Verified baseline

The current root application is a client-only React 19 and TypeScript application built with Vite 5 and deployed as static assets on Netlify. It provides:

- Streaming chat with Google Gemini 2.5 Flash.
- Markdown and syntax-highlighted response rendering.
- Browser-side extraction for PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, ZIP, text, and common source files.
- In-memory chunking, TF-IDF retrieval, and prompt context injection.
- Five specialized modes, four writing tones, and configurable response rubrics.
- Responsive navigation, profile settings, file suggestions, and session reset.
- Local PDF worker bundling, partial-extraction reporting, typed PDF errors, and scanned-document detection.
- An installable PWA whose service worker precaches only the static application shell.

The baseline has no application backend, database, account system, server-side authentication, billing system, or subscription enforcement. Messages, documents, extracted text, and retrieval vectors remain in browser memory. The user-supplied Gemini API key is session-only by default. A user may explicitly opt to remember it on the device, in which case it is persisted in local storage until removed. The profile is also stored locally. Prompts and selected document context are sent directly from the browser to the Gemini API.

## Canonical root decision

The repository root is the sole canonical application and deployment source:

- Root `package.json` owns dependencies and scripts.
- Root `src/` owns application code.
- Root `public/` owns static and PWA assets.
- Root `vite.config.ts` owns the build and service-worker policy.
- Root `netlify.toml` builds the root project and publishes root `dist/`.

The `scholar-ai/` directory is a preserved legacy snapshot. It must not be used as Netlify's base directory, treated as a second release target, or changed incidentally during root stabilization. Any future removal or archival is a separate, explicitly reviewed repository-maintenance task.

## PWA and data-caching boundary

The PWA improves installation and repeat loading of immutable application code. Workbox precaches generated HTML, JavaScript, CSS, fonts, and static images. Runtime caching is deliberately empty.

The service worker must not cache:

- Gemini or other third-party API requests and responses.
- Streaming response bodies, API keys, authorization material, or credential-bearing URLs.
- Uploaded files or extracted document content.
- Chat messages, retrieval chunks, embeddings, or profile data.
- Future account, billing, or subscription API traffic.

Any proposal to add runtime caching requires a privacy and security review, an explicit route allowlist, expiration behavior, and tests proving user or API data cannot enter Cache Storage.

## Roadmap phases

### Phase 0 — Root stabilization

- Keep root as the single build and deployment target.
- Maintain a reproducible Node 20 build.
- Enforce restrictive browser security headers and static-shell-only PWA caching.
- Validate installation, updates, offline shell startup, and cache boundaries.
- Add automated install, lint, test, build, service-worker, and deployment checks.
- Resolve known dependency findings through separately reviewed upgrades.

### Phase 1 — Client reliability and trust

- Add document fixtures and tests for corrupt, encrypted, scanned, partial, empty, and oversized files.
- Define file size, page count, decompression, concurrency, memory, and prompt-context limits.
- Improve privacy copy so local processing and Gemini-bound context are clearly distinguished.
- Add privacy-aware diagnostics without logging contents, credentials, or sensitive URLs.
- Measure retrieval relevance, improve multilingual tokenization and context budgeting, and strengthen prompt-injection resistance.
- Test accessibility, mobile installation, update recovery, and degraded/offline behavior.

### Phase 2 — Production backend and accounts

Phase 2 is the planned next product phase after stabilization and client reliability. It introduces the production service architecture described by the supplied roadmap:

- Firebase Authentication for user registration, login, identity, and account recovery.
- Account-backed profiles and durable user ownership boundaries.
- Cloud Storage for managed document and user-file storage.
- Cloud Run services for backend APIs, Gemini mediation, policy enforcement, and operational controls.
- Durable application data, server-side authorization, usage controls, and cross-device continuity.
- Migration paths from the current client-only session model.

This work requires a separately approved architecture, threat model, privacy/data-retention design, Firebase and Google Cloud configuration, operating-cost model, and migration plan. It is planned product work, but it is explicitly out of scope for the current `stabilize/root-security-pwa` branch.

### Phase 3 — RAG

- Introduce production-grade RAG over managed user documents.
- Define indexing, retrieval quality, citations, tenancy, and deletion requirements.

### Phase 4 — Performance and cloud processing

- Move parsing, chunking, embeddings, and indexing from the browser to managed cloud services.
- Add queues, resource limits, observability, retries, and cost controls for large documents.

### Phase 5 — Multi-model

- Add a governed model abstraction for supported providers and models.
- Define capability, privacy, quality, pricing, and fallback policies per model.

### Phase 6 — Personal Buddy / local Ollama

- Develop the optional local Personal Buddy experience using Ollama or another approved local runtime.
- Keep local-model data boundaries and hardware requirements explicit.

### Future commercial capability

After the identity, backend, and usage-control foundation is production-ready, the product may add subscription tiers, checkout, billing, entitlements, quotas, and account-level usage enforcement. This commercial work is not part of the stabilization branch.

## Stabilization branch exclusions

The following planned capabilities must not be implemented or represented as completed by this branch:

- Firebase Authentication or account recovery.
- Cloud Storage uploads or durable document persistence.
- Cloud Run services, server-side Gemini mediation, or managed API credentials.
- Database-backed chat, profile, or document history.
- Organization, classroom, team, or sharing features.
- Subscription checkout, invoices, entitlements, or usage billing.

These are roadmap commitments for later product phases, not optional possibilities and not current baseline capabilities. Their implementation requires separate authorization and release criteria.

## Release runbook

### 1. Confirm scope and repository state

1. Work from an explicitly approved release branch.
2. Confirm the working tree contains only intended root changes.
3. Confirm no file under `scholar-ai/` changed.
4. Review dependency and lockfile diffs for unexpected package movement.

### 2. Validate locally

Using Node.js 20:

```bash
npm ci
npm run lint
npm test
npm run build
```


Then verify:

- `dist/index.html`, `dist/manifest.webmanifest`, and `dist/sw.js` exist.
- Manifest icons resolve to valid 192×192 and 512×512 PNGs.
- The generated precache contains static shell assets only.
- The service worker contains no Gemini hostname, API route, credential, uploaded-document, or user-data runtime caching rule.
- The deployed Content Security Policy permits connections only to the same origin and `generativelanguage.googleapis.com`.
- Workers are limited to same-origin and blob URLs; framing and objects are denied.
- A fresh browser session can install the application.
- An open client receives an update after a subsequent deployment.
- Chat requires network access and Gemini traffic is not served from Cache Storage.

### 3. Review deployment configuration

1. Netlify base directory is empty.
2. Build command is `npm run build`.
3. Publish directory is `dist`.
4. Runtime is Node.js 20.
5. `sw.js`, the web manifest, and `index.html` use revalidation/no-cache headers.
6. Hashed `/assets/*` and generated Workbox assets use immutable caching.
7. The restrictive Content Security Policy is present on all routes.

### 4. Release approval

Record the commit under review, validation results, known dependency findings, and a rollback owner. Do not deploy from an unreviewed working tree. Promotion, merge, tagging, and deployment require explicit lead engineer or product owner authorization.

### 5. Post-deployment smoke test

- Load the site in a clean profile and confirm the root build version.
- Install the PWA and relaunch it.
- Upload a small supported document and complete one streamed Gemini request.
- Confirm Cache Storage contains application shell assets only.
- Confirm Gemini requests reach the network and are not intercepted from cache.
- Confirm the browser reports no unexpected CSP violations.
- Verify a service-worker update on desktop and a mobile-class browser.

### 6. Rollback

If installation, startup, asset loading, CSP enforcement, or update behavior regresses, restore the last known-good Netlify deployment. After rollback, unregister the faulty service worker in a clean test profile, document whether cached clients require remediation, and open a root-scoped corrective change before redeployment.
