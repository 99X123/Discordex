import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface ContextMenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  success?: boolean;
  divider?: boolean;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface ContextMenuContextType {
  openMenu: (event: { clientX: number; clientY: number; preventDefault?: () => void }, items: ContextMenuItem[]) => void;
  closeMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

export const useContextMenu = () => {
  const context = useContext(ContextMenuContext);
  if (!context) throw new Error('useContextMenu must be used within ContextMenuProvider');
  return context;
};

export const ContextMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [menu, setMenu] = useState<MenuState | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  const openMenu = useCallback<ContextMenuContextType['openMenu']>((event, items) => {
    event.preventDefault?.();
    const menuWidth = 220;
    const menuHeight = items.length * 38 + 16;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
    setMenu({ x: Math.max(8, x), y: Math.max(8, y), items });
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMenu(); };
    const onClick = () => closeMenu();
    const onResize = () => closeMenu();
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    window.addEventListener('blur', closeMenu);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('blur', closeMenu);
      window.removeEventListener('resize', onResize);
    };
  }, [menu, closeMenu]);

  return (
    <ContextMenuContext.Provider value={{ openMenu, closeMenu }}>
      {children}
      {menu && (
        <div
          className="fixed z-[100] min-w-[200px] max-w-[260px] bg-discordex-surface border border-discordex-border rounded-xl p-1.5 shadow-2xl animate-fade-in"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {menu.items.map((item, index) => (
            <React.Fragment key={index}>
              {item.divider && <div className="h-px bg-discordex-border my-1" />}
              {item.label !== undefined && item.label !== '' && (
                <button
                  onClick={() => {
                    closeMenu();
                    item.onClick?.();
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left ${
                    item.danger
                      ? 'text-discordex-danger hover:bg-discordex-danger/10'
                      : item.success
                        ? 'text-discordex-success hover:bg-discordex-success/10'
                        : 'text-discordex-text-primary hover:bg-discordex-hover'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </ContextMenuContext.Provider>
  );
};
