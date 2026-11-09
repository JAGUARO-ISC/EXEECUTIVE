import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<Props> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, [onClose]);
  const width = 210;
  const height = items.length * 38 + 16;
  return (
    <div ref={ref} className="context-menu" style={{ left: Math.min(x, window.innerWidth - width - 8), top: Math.min(y, window.innerHeight - height - 8) }} role="menu">
      {items.map((item) => <button key={item.label} role="menuitem" disabled={item.disabled} className={item.danger ? 'danger' : ''} onClick={() => { item.onSelect(); onClose(); }}>{item.label}</button>)}
    </div>
  );
};
