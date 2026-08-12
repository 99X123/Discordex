import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppProvider, useApp } from './context/AppContext';
import { SidebarServers } from './components/SidebarServers';
import { SidebarChannels } from './components/SidebarChannels';
import { SidebarDMs } from './components/SidebarDMs';
import { ChatArea } from './components/ChatArea';
import { SidebarMembers } from './components/SidebarMembers';
import { CallView } from './components/CallView';
import { FriendsView } from './components/FriendsView';
import { SettingsPanel } from './components/SettingsPanel';
import { Modals } from './components/Modals';
import { ToastContainer } from './components/SharedUI';
import { ContextMenuProvider } from './components/ContextMenu';
import { AuthPage } from './components/AuthPage';
import { supabase } from './lib/supabase';
import { Menu } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { activeServerId, activeDmId, callState } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      
      {/* Sidebar Servers & Sidebar Channels (collapsible drawers on mobile/tablet) */}
      <div 
        className={`fixed inset-y-0 left-0 z-40 flex transition-transform duration-300 md:relative md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarServers />
        {activeServerId !== null ? <SidebarChannels /> : <SidebarDMs />}
      </div>

      {/* Backdrop overlay for mobile drawer */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden animate-fade-in"
        />
      )}

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Floating Mobile menu trigger button */}
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className={`absolute left-4 top-2.5 z-30 md:hidden p-1.5 bg-discordex-surface rounded-lg border border-discordex-border text-discordex-text-secondary hover:text-discordex-text-primary transition-all ${
            mobileMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <Menu className="w-4.5 h-4.5" />
        </button>

        {/* Video / Voice Call Window (if connected to a voice channel) */}
        {callState.isActive && <CallView />}

        <div className="flex-1 flex min-w-0 overflow-hidden">
          {activeServerId === null && activeDmId === null ? (
            <FriendsView />
          ) : (
            <ChatArea onToggleSidebar={() => setMobileMenuOpen(true)} />
          )}

          {/* Right sidebars details (e.g. Members list in servers, hidden on tablet/mobile screens) */}
          {activeServerId !== null && (
            <div className="hidden lg:block">
              <SidebarMembers />
            </div>
          )}
        </div>

      </div>

      {/* Global Panels */}
      <SettingsPanel />
      <Modals />
      <ToastContainer />

    </div>
  );
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="h-screen bg-discordex-bg text-discordex-text-primary flex items-center justify-center text-sm">Carregando...</div>;
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <AppProvider>
      <ContextMenuProvider>
        <DashboardContent />
      </ContextMenuProvider>
    </AppProvider>
  );
}

export default App;
