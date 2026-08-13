import React from 'react';
import { useApp } from '../context/AppContext';
import { PhoneSlash, VideoCamera, Phone, PhoneCall } from '@phosphor-icons/react';

export const IncomingCallOverlay: React.FC = () => {
  const { incomingCall, answerCall, declineCall } = useApp();

  if (!incomingCall) return null;

  const { caller, type } = incomingCall;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-sm bg-signal-surface border border-signal-border panel-cut-lg p-8 flex flex-col items-center gap-5 shadow-float-lg">
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-brass/30 animate-ping" />
          <img
            src={caller.avatar}
            alt={caller.displayName}
            className="relative w-24 h-24 rounded-full object-cover border-4 border-brass/60 shadow-brass-lg"
          />
        </div>

        <div className="text-center">
          <p className="text-lg font-display font-bold text-signal-text-primary">{caller.displayName}</p>
          <p className="text-xs text-signal-warning mt-1 animate-pulse font-mono">
            {type === 'video'
              ? 'CHAMADA DE VÍDEO RECEBIDA…'
              : 'CHAMADA DE VOZ RECEBIDA…'}
          </p>
        </div>

        <div className="flex items-center gap-6 mt-2">
          <button
            onClick={() => void declineCall()}
            className="w-12 h-12 rounded-md bg-signal-danger hover:bg-signal-danger/80 text-white flex items-center justify-center transition-colors"
            title="Recusar"
          >
            <PhoneSlash className="w-5 h-5" />
          </button>

          <button
            onClick={() => void answerCall()}
            className="w-12 h-12 rounded-md bg-signal-success hover:bg-signal-success/80 text-white flex items-center justify-center transition-colors"
            title="Atender"
          >
            {type === 'video' ? <VideoCamera className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-signal-text-secondary text-[10px] font-mono">
          <PhoneCall className="w-3 h-3" />
          <span>Toque de chamada privada</span>
        </div>
      </div>
    </div>
  );
};