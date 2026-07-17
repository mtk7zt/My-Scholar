import { readFile, stat } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
for (const key of ['name', 'short_name', 'start_url', 'scope', 'display', 'theme_color', 'background_color', 'icons']) {
  if (!manifest[key]) throw new Error(`Manifest is missing ${key}`);
}
if (manifest.display !== 'standalone' || manifest.start_url !== '/' || manifest.scope !== '/') throw new Error('Manifest launch configuration is invalid');
if (!manifest.icons.some(icon => icon.purpose === 'maskable')) throw new Error('Manifest requires a maskable icon');
await stat('dist/sw.js'); await stat('dist/icon-192.png'); await stat('dist/icon-512.png');
const sw = await readFile('dist/sw.js', 'utf8');
for (const forbidden of ['tessdata', 'tesseract', 'generativelanguage.googleapis.com', 'ingest.sentry.io', 'scholar_api_key']) {
  if (sw.includes(forbidden)) throw new Error(`Service worker contains forbidden cache target: ${forbidden}`);
}
console.log('PWA manifest and cache policy verified');
