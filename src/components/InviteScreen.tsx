import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getInviteDetails, type InviteDetails } from '../services/servers';
import { Users, SignIn, DoorOpen, Warning, X } from '@phosphor-icons/react';

interface InviteScreenProps {
  code: string;
  onClose: () => void;
}

export const InviteScreen: React.FC<InviteScreenProps> = ({ code, onClose }) => {
  const { joinServer, setActiveServerId } = useApp();
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void getInviteDetails(code).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.success || !result.details) {
        setError(result.error || 'Convite invalido.');
        return;
      }
      setDetails(result.details);
    });
    return () => {
      active = false;
    };
  }, [code]);

  const accept = async () => {
    if (joining) return;
    setJoining(true);
    await joinServer(code);
    setJoining(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-signal-bg animate-fade-in">
      <div className="w-full max-w-md bg-signal-secondary border border-signal-border panel-cut-lg shadow-float-lg animate-slide-up">
        <div className="p-8 flex flex-col items-center text-center">
          <button
            onClick={onClose}
            className="self-end -mt-4 -mr-4 mb-2 text-signal-text-secondary hover:text-signal-text-primary transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {loading && (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-signal-border border-t-brass rounded-full animate-spin" />
              <p className="text-xs text-signal-text-secondary">Carregando convite...</p>
            </div>
          )}

          {!loading && error && (
            <div className="py-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-signal-danger/15 flex items-center justify-center">
                <Warning className="w-8 h-8 text-signal-danger" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-signal-text-primary">Convite invalido</h2>
                <p className="text-xs text-signal-text-secondary mt-1">{error}</p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-signal-surface hover:bg-signal-hover border border-signal-border text-signal-text-primary rounded-md text-sm font-semibold transition-colors"
              >
                Voltar ao app
              </button>
            </div>
          )}

          {!loading && !error && details && (
            <>
              {details.serverIcon ? (
                <img
                  src={details.serverIcon}
                  alt={details.serverName}
                  className="w-20 h-20 rounded-md object-cover mb-5"
                />
              ) : (
                <div className="w-20 h-20 rounded-md bg-brass flex items-center justify-center text-signal-bg text-2xl font-black mb-5">
                  {details.serverName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <p className="text-xs text-signal-text-secondary font-mono">Convidado para</p>
              <h2 className="text-xl font-display font-bold text-signal-text-primary mt-1">{details.serverName}</h2>

              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-signal-text-secondary">
                <Users className="w-3.5 h-3.5" />
                <span className="font-mono">{details.memberCount} membros</span>
              </div>

              {details.alreadyMember ? (
                <>
                  <p className="text-xs text-signal-success mt-6">
                    Voce ja faz parte deste servidor
                  </p>
                  <button
                    onClick={() => {
                      setActiveServerId(details.serverId);
                      onClose();
                    }}
                    className="mt-4 w-full px-5 py-3 bg-brass hover:bg-brass-hover text-signal-bg rounded-md text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <DoorOpen className="w-4 h-4" />
                    Ir para o servidor
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => void accept()}
                    disabled={joining}
                    className="mt-6 w-full px-5 py-3 bg-brass hover:bg-brass-hover disabled:opacity-60 text-signal-bg rounded-md text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <SignIn className="w-4 h-4" />
                    {joining ? 'Entrando...' : 'Entrar no servidor'}
                  </button>
                  <button
                    onClick={onClose}
                    className="mt-2 w-full px-5 py-3 text-signal-text-secondary hover:text-signal-text-primary rounded-md text-sm font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};