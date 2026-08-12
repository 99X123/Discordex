import React from 'react';
import { useApp } from '../context/AppContext';
import { Phone, PhoneOff, Video, PhoneCall } from 'lucide-react';

export const IncomingCallOverlay: React.FC = () => {
  const { incomingCall, answerCall, declineCall } = useApp();

  if (!incomingCall) return null;

  const { caller, type } = incomingCall;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm bg-discordex-surface border border-discordex-border rounded-3xl p-8 flex flex-col items-center gap-5 shadow-2xl">
        <div className="relative shrink-0">
          <div className={`absolute inset-0 rounded-full ${type === 'video' ? 'bg-primary/30' : 'bg-discordex-success/30'} animate-ping`} />
          <img
            src={caller.avatar}
            alt={caller.displayName}
            className="relative w-24 h-24 rounded-full object-cover border-4 border-discordex-border/60"
          />
        </div>

        <div className="text-center">
          <p className="text-lg font-bold text-discordex-text-primary">{caller.displayName}</p>
          <p className="text-xs text-discordex-text-secondary mt-1 animate-pulse">
            {type === 'video'
              ? 'Chamada de vídeo recebida...'
              : 'Chamada de voz recebida...'}
          </p>
        </div>

        <div className="flex items-center gap-6 mt-2">
          <button
            onClick={() => void declineCall()}
            className="w-12 h-12 rounded-full bg-discordex-danger hover:bg-discordex-danger/80 text-white flex items-center justify-center transition-colors"
            title="Recusar"
          >
            <PhoneOff className="w-5 h-5" />
          </button>

          <button
            onClick={() => void answerCall()}
            className="w-12 h-12 rounded-full bg-discordex-success hover:bg-discordex-success/80 text-white flex items-center justify-center transition-colors"
            title="Atender"
          >
            {type === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-discordex-text-secondary text-[10px]">
          <PhoneCall className="w-3 h-3" />
          <span>Toque de chamada privada</span>
        </div>
      </div>
    </div>
  );
};