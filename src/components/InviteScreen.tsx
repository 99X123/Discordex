import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getInviteDetails, type InviteDetails } from '../services/servers';
import { Users, LogIn, DoorOpen, AlertTriangle, X } from 'lucide-react';

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-discordex-bg">
      <div className="w-full max-w-md bg-discordex-secondary border border-discordex-border rounded-3xl overflow-hidden shadow-2xl animate-slide-up">
        <div className="p-8 flex flex-col items-center text-center">
          <button
            onClick={onClose}
            className="self-end -mt-4 -mr-4 mb-2 text-discordex-text-secondary hover:text-discordex-text-primary transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {loading && (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-discordex-border border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-discordex-text-secondary">Carregando convite...</p>
            </div>
          )}

          {!loading && error && (
            <div className="py-10 flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-discordex-danger/15 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-discordex-danger" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-discordex-text-primary">Convite invalido</h2>
                <p className="text-xs text-discordex-text-secondary mt-1">{error}</p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-discordex-surface hover:bg-discordex-hover border border-discordex-border text-discordex-text-primary rounded-xl text-sm font-semibold transition-colors"
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
                  className="w-20 h-20 rounded-2xl object-cover mb-5"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-white text-2xl font-bold mb-5">
                  {details.serverName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <p className="text-xs text-discordex-text-secondary">Convidado para</p>
              <h2 className="text-xl font-bold text-discordex-text-primary mt-1">{details.serverName}</h2>

              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-discordex-text-secondary">
                <Users className="w-3.5 h-3.5" />
                <span>{details.memberCount} membros</span>
              </div>

              {details.alreadyMember ? (
                <>
                  <p className="text-xs text-discordex-success mt-6">
                    Voce ja faz parte deste servidor
                  </p>
                  <button
                    onClick={() => {
                      setActiveServerId(details.serverId);
                      onClose();
                    }}
                    className="mt-4 w-full px-5 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
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
                    className="mt-6 w-full px-5 py-3 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    {joining ? 'Entrando...' : 'Entrar no servidor'}
                  </button>
                  <button
                    onClick={onClose}
                    className="mt-2 w-full px-5 py-3 text-discordex-text-secondary hover:text-discordex-text-primary rounded-xl text-sm font-semibold transition-colors"
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