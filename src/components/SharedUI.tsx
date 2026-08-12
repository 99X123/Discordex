import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

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
      <div className={`absolute z-50 pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 ease-out whitespace-nowrap bg-discordex-surface border border-discordex-border text-discordex-text-primary px-3 py-1.5 rounded-md text-xs font-medium shadow-xl ${positionClasses[position]}`}>
        {content}
        <div className={`absolute w-2 h-2 bg-discordex-surface border-discordex-border transform rotate-45 ${
          position === 'right' ? '-left-1 top-1/2 -translate-y-1/2 border-l border-b' :
          position === 'bottom' ? '-top-1 left-1/2 -translate-x-1/2 border-t border-l' :
          position === 'top' ? '-bottom-1 left-1/2 -translate-x-1/2 border-r border-b' :
          '-right-1 top-1/2 -translate-y-1/2 border-t border-r'
        }`} />
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {toasts.map(toast => {
        const icon = {
          success: <CheckCircle2 className="w-5 h-5 text-discordex-success shrink-0" />,
          error: <AlertTriangle className="w-5 h-5 text-discordex-danger shrink-0" />,
          info: <Info className="w-5 h-5 text-primary shrink-0" />
        }[toast.type];

        return (
          <div
            key={toast.id}
            className="flex items-center gap-3 bg-discordex-surface border border-discordex-border p-4 rounded-xl shadow-2xl animate-slide-up pointer-events-auto"
          >
            {icon}
            <span className="text-sm font-medium text-discordex-text-primary">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-discordex-text-secondary hover:text-discordex-text-primary p-0.5 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
