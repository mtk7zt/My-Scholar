/**
 * App.tsx
 *
 * Root component. Composes the full application layout:
 * - Header (always visible)
 * - Sidebar (left panel on desktop, drawer on mobile)
 * - ChatArea (main content, takes remaining space)
 * - SettingsModal (profile + API key + mode/tone/rubric settings)
 * - ApiKeyModal (first-run onboarding if no key stored)
 *
 * Registers a beforeunload listener to clear all session data
 * (messages, documents, embeddings) when the tab closes or refreshes.
 */

import { useEffect } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { useStore } from './store/useStore';

function App() {
  const { newChat } = useStore();

  // Clear all session data when the tab closes or refreshes
  useEffect(() => {
    const handleBeforeUnload = () => {
      newChat();
      localStorage.removeItem('scholar_session');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [newChat]);

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a] overflow-hidden">
      <ApiKeyModal />
      <SettingsModal />
      <Header />
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col min-h-0 min-w-0 w-full">
          <ChatArea />
        </main>
      </div>
    </div>
  );
}

export default App;
