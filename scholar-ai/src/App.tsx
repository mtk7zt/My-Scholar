/**
 * App.tsx
 *
 * Root component. Composes the full application layout and registers
 * a beforeunload listener to clear all session data (messages, documents,
 * embeddings) when the user closes or refreshes the tab.
 */

import { useEffect } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Header } from './components/Header';
import { useStore } from './store/useStore';

function App() {
  const { newChat } = useStore();

  // Clear all data when tab closes or refreshes
  useEffect(() => {
    const handleBeforeUnload = () => {
      newChat();
      localStorage.removeItem('scholar_session');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a] overflow-hidden">
      <ApiKeyModal />
      <Header />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          <ChatArea />
        </main>
      </div>
    </div>
  );
}

export default App;
