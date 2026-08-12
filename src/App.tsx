import React, { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppProvider, useApp } from './context/AppContext';
import { SidebarServers } from './components/SidebarServers';
import { SidebarChannels } from './components/SidebarChannels';
import { SidebarDMs } from './components/SidebarDMs';
import { ChatArea } from './components/ChatArea';
import { SidebarMembers } from './components/SidebarMembers';
import { CallView } from './components/CallView';
import { IncomingCallOverlay } from './components/IncomingCallOverlay';
import { FriendsView } from './components/FriendsView';
import { SettingsPanel } from './components/SettingsPanel';
import { Modals } from './components/Modals';
import { ToastContainer } from './components/SharedUI';
import { ContextMenuProvider } from './components/ContextMenu';
import { AuthPage } from './components/AuthPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { supabase } from './lib/supabase';
import { unlockAudio } from './lib/sounds';
import { Menu } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { activeServerId, activeDmId, callState, joinServer } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const inviteProcessed = useRef(false);

  useEffect(() => {
    if (inviteProcessed.current) return;
    inviteProcessed.current = true;

    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite');
    const storedInvite = localStorage.getItem('discordex:pending-invite');

    const code = inviteParam || storedInvite;
    if (code) {
      if (inviteParam) {
        localStorage.setItem('discordex:pending-invite', code);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      window.setTimeout(() => {
        localStorage.removeItem('discordex:pending-invite');
        void joinServer(code);
      }, 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <IncomingCallOverlay />

    </div>
  );
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryPending, setRecoveryPending] = useState(() =>
    typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
  );

  useEffect(() => {
    const staleSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { error } = await supabase.auth.getUser();
        if (error) {
          await supabase.auth.signOut().catch(() => { /* ignore */ });
        }
      }
      setSession(data.session);
      setLoading(false);
    };
    staleSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryPending(true);
      setSession(nextSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  if (loading) {
    return <div className="h-screen bg-discordex-bg text-discordex-text-primary flex items-center justify-center text-sm">Carregando...</div>;
  }

  if (recoveryPending) {
    return (
      <ResetPasswordPage
        onComplete={async () => {
          await supabase.auth.signOut().catch(() => { /* ignore */ });
          setRecoveryPending(false);
          setSession(null);
          window.history.replaceState({}, document.title, window.location.pathname);
        }}
      />
    );
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
