import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useStore } from '../store/useStore';

export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const busy = useStore(state => state.isLoading || state.documents.some(doc => !['ready', 'partial', 'cancelled', 'error'].includes(doc.status)));
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({ immediate: true });
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  if (!needRefresh && online) return null;
  return (
    <div className="status-banner" role="status" aria-live="polite">
      {!online ? <span>Offline: local document processing may work when its assets are available. Gemini requires a connection.</span> : null}
      {needRefresh ? <span>{busy ? 'Update ready after current work.' : 'A new version is available.'}</span> : null}
      {needRefresh && !busy ? <button onClick={() => updateServiceWorker(true)}>Refresh now</button> : null}
      {needRefresh ? <button onClick={() => setNeedRefresh(false)}>Later</button> : null}
    </div>
  );
}
