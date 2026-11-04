import React, { useMemo, useState } from 'react';
import { IconPlus, IconSearch, IconStar, IconStarFilled } from '@tabler/icons-react';
import { useNoteStore } from '../../stores';
import { quick, useUi } from '../../stores/ui';
import { NOTE_CATEGORIES } from '../../utils/categories';
import { Empty, PageHead } from '../common/ui';
import type { Note } from '../../types';

export const NotesPage: React.FC = () => {
  const notes = useNoteStore((s) => s.items);
  const error = useNoteStore((s) => s.error);
  const open = useUi((s) => s.open);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [onlyImportant, setOnlyImportant] = useState(false);

  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    return notes.filter((n) => {
      if (onlyImportant && !n.important) return false;
      if (category && n.category !== category) return false;
      return !text || `${n.title} ${n.content ?? ''}`.toLowerCase().includes(text);
    });
  }, [notes, q, category, onlyImportant]);

  const toggleStar = (n: Note) => {
    const { id, ...rest } = n;
    void useNoteStore.getState().update(id!, { ...rest, important: !n.important });
  };

  return (
    <div className="page">
      <PageHead title="Note e appunti" sub={`${notes.length} ${notes.length === 1 ? 'nota' : 'note'}`}>
        <button className="primary-btn" onClick={quick.note}><IconPlus size={16} stroke={2.5} /> Nuova nota</button>
      </PageHead>
      {error && <div className="err">{error}</div>}

      <div className="filters">
        <label className="search wide"><IconSearch size={15} /><input placeholder="Cerca nelle note" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="filters-right">
          <select className="select" aria-label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Ogni categoria</option>
            {NOTE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className={`ghost-btn${onlyImportant ? ' on' : ''}`} aria-pressed={onlyImportant} onClick={() => setOnlyImportant(!onlyImportant)}>
            <IconStar size={14} /> Importanti
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <Empty>{notes.length === 0 ? 'Nessuna nota. Premi "Nuova nota" per scrivere la prima.' : 'Nessuna nota corrisponde alla ricerca.'}</Empty>
      ) : (
        <div className="note-grid">
          {list.map((n) => (
            <article key={n.id} className="note" data-testid="note-card">
              <button className="note-body" onClick={() => open({ type: 'note', note: n })}>
                <h3 className="note-title">{n.title}</h3>
                {n.content && <p className="note-text">{n.content}</p>}
              </button>
              <footer className="note-foot">
                <span className="muted">
                  {n.category ?? 'Senza categoria'}
                  {n.linkedDate ? ` · ${new Date(`${n.linkedDate}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ''}
                </span>
                <button className="icon-btn flat" aria-label={n.important ? 'Rimuovi importante' : 'Segna importante'} onClick={() => toggleStar(n)}>
                  {n.important ? <IconStarFilled size={16} color="#ff6f1a" /> : <IconStar size={16} />}
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
