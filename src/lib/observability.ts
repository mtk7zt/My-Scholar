import * as Sentry from '@sentry/react';

const SAFE_KEYS = new Set(['release', 'environment', 'browser', 'viewport', 'fileCategory', 'sizeBucket', 'pageBucket', 'ocrLanguage', 'stage', 'durationMs', 'code', 'result']);

export function initializeObservability(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: __BUILD_ID__,
    sendDefaultPii: false,
    integrations: [],
    beforeSend(event) {
      event.request = undefined;
      event.user = undefined;
      event.breadcrumbs = event.breadcrumbs?.filter(item => item.category !== 'console' && item.category !== 'fetch');
      event.extra = Object.fromEntries(Object.entries(event.extra ?? {}).filter(([key]) => SAFE_KEYS.has(key)));
      return event;
    },
  });
}

export function captureSafeError(error: unknown, context: Record<string, string | number | boolean>): void {
  Sentry.captureException(error, { extra: Object.fromEntries(Object.entries(context).filter(([key]) => SAFE_KEYS.has(key))) });
}
