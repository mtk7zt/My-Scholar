/** Requests session-level consent before retrieved document excerpts leave the browser. */
export function ensureDocumentSharingConsent(
  alreadyGranted: boolean,
  grantConsent: () => void,
): boolean {
  if (alreadyGranted) return true;

  const granted = window.confirm(
    'Use document excerpts with Gemini?\n\n' +
    'Your files are parsed and searched locally in this browser. To answer this question, ' +
    'Scholar AI will send the relevant excerpts, your prompt, and conversation context to Google Gemini. ' +
    'This permission lasts until you close or refresh this tab.'
  );

  if (granted) grantConsent();
  return granted;
}
