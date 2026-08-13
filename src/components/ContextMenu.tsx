import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Check, CaretRight } from '@phosphor-icons/react';

export interface ContextMenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  success?: boolean;
  divider?: boolean;
  checked?: boolean;
  disabled?: boolean;
  keepOpen?: boolean;
  submenu?: ContextMenuItem[];
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

const MENU_WIDTH = 240;

const MenuList: React.FC<{ items: ContextMenuItem[]; onClose: () => void }> = ({ items, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [subLeft, setSubLeft] = useState(true);

  const handleEnter = (index: number, item: ContextMenuItem) => {
    if (item.submenu && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setSubLeft(rect.right + 8 + MENU_WIDTH <= window.innerWidth);
      setOpenIndex(index);
    } else {
      setOpenIndex(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative min-w-[200px] max-w-[260px] bg-signal-surface border border-signal-border rounded-md p-1.5 shadow-float-lg animate-fade-in"
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.divider && <div className="h-px bg-signal-border my-1" />}
          {item.label !== undefined && item.label !== '' && (
            <div className="relative" onMouseEnter={() => handleEnter(index, item)}>
              <button
                disabled={item.disabled}
                onClick={() => {
                  if (!item.submenu && !item.keepOpen) onClose();
                  item.onClick?.();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors text-left ${
                  item.danger
                    ? 'text-signal-danger hover:bg-signal-danger/10'
                    : item.success
                      ? 'text-signal-success hover:bg-signal-success/10'
                      : 'text-signal-text-primary hover:bg-brass hover:text-signal-bg'
                } ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {item.icon}
                <span className="truncate flex-1">{item.label}</span>
                {item.checked && <Check className="w-4 h-4 shrink-0" weight="bold" />}
                {item.submenu && <CaretRight className="w-4 h-4 shrink-0 opacity-70" />}
              </button>
              {openIndex === index && item.submenu && (
                <div
                  className="absolute top-0 z-10"
                  style={subLeft ? { left: '100%' } : { right: '100%' }}
                >
                  <MenuList items={item.submenu} onClose={onClose} />
                </div>
              )}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export const ContextMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [menu, setMenu] = useState<MenuState | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  const openMenu = useCallback<ContextMenuContextType['openMenu']>((event, items) => {
    event.preventDefault?.();
    const menuHeight = items.reduce((acc, item) => acc + (item.divider ? 9 : 40), 20);
    const x = Math.min(event.clientX, window.innerWidth - MENU_WIDTH - 8);
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
          className="fixed z-[100]"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <MenuList items={menu.items} onClose={closeMenu} />
        </div>
      )}
    </ContextMenuContext.Provider>
  );
};