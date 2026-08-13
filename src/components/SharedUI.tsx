import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle, Warning, Info, X } from '@phosphor-icons/react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'right' | 'bottom' | 'top' | 'left';
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'right' }) => {
  const positionClasses = {
    right: 'left-full top-1/2 -translate-y-1/2 ml-3',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-3',
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-3',
    left: 'right-full top-1/2 -translate-y-1/2 mr-3',
  };

  return (
    <div className="relative flex items-center group">
      {children}
      <div className={`absolute z-50 pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 ease-out whitespace-nowrap bg-signal-surface border border-signal-border text-signal-text-primary px-3 py-1.5 rounded-md text-xs font-medium shadow-float-lg ${positionClasses[position]}`}>
        {content}
        <div className={`absolute w-2 h-2 bg-signal-surface border-signal-border transform rotate-45 ${
          position === 'right' ? '-left-1 top-1/2 -translate-y-1/2 border-l border-b' :
          position === 'bottom' ? '-top-1 left-1/2 -translate-x-1/2 border-t border-l' :
          position === 'top' ? '-bottom-1 left-1/2 -translate-x-1/2 border-r border-b' :
          '-right-1 top-1/2 -translate-y-1/2 border-t border-r'
        }`} />
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// SINAL — medidor de transmissão (VU). Quem fala acende o medidor,
// nunca um anel de glow ao redor do avatar.
// ------------------------------------------------------------------
interface TransmitMeterProps {
  bars?: number;
  className?: string;
  state?: 'live' | 'idle' | 'scan';
}

export const TransmitMeter: React.FC<TransmitMeterProps> = ({ bars = 5, className = '', state = 'live' }) => {
  const stateClass = state === 'idle' ? 'transmit-meter--idle' : state === 'scan' ? 'transmit-meter--scan' : '';
  return (
    <span aria-hidden="true" className={`transmit-meter ${stateClass} ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className="tm-bar" />
      ))}
    </span>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {toasts.map(toast => {
        const { icon, border } = {
          success: { icon: <CheckCircle className="w-5 h-5 text-signal-success shrink-0" />, border: 'border-l-signal-success' },
          error: { icon: <Warning className="w-5 h-5 text-signal-danger shrink-0" />, border: 'border-l-signal-danger' },
          info: { icon: <Info className="w-5 h-5 text-brass shrink-0" />, border: 'border-l-brass' }
        }[toast.type];

        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 glass-panel p-4 rounded-md shadow-float-lg animate-slide-up pointer-events-auto border-l-[3px] ${border}`}
          >
            {icon}
            <span className="text-sm font-medium text-signal-text-primary">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-signal-text-secondary hover:text-signal-text-primary p-0.5 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};