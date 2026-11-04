import React, { useMemo, useState } from 'react';
import { IconCheck, IconPlus, IconSearch } from '@tabler/icons-react';
import { toggleTask, useTaskStore } from '../../stores';
import { quick, useUi } from '../../stores/ui';
import { addDays, dateKey } from '../../utils/date';
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS, TASK_CATEGORIES } from '../../utils/categories';
import { Empty, PageHead, Panel } from '../common/ui';
import type { Task } from '../../types';

type Filter = 'open' | 'today' | 'week' | 'overdue' | 'done' | 'all';

const FILTERS: [Filter, string][] = [
  ['open', 'Aperte'],
  ['today', 'Oggi'],
  ['week', 'Questa settimana'],
  ['overdue', 'In ritardo'],
  ['done', 'Completate'],
  ['all', 'Tutte'],
];

export const TasksPage: React.FC = () => {
  const tasks = useTaskStore((s) => s.items);
  const error = useTaskStore((s) => s.error);
  const open = useUi((s) => s.open);
  const [filter, setFilter] = useState<Filter>('open');
  const [priority, setPriority] = useState<number | null>(null);
  const [category, setCategory] = useState<string>('');
  const [q, setQ] = useState('');

  const today = dateKey(new Date());
  const weekEnd = dateKey(addDays(new Date(), 7));

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { open: 0, today: 0, week: 0, overdue: 0, done: 0, all: tasks.length };
    for (const t of tasks) {
      if (t.status === 'done') c.done++;
      else {
        c.open++;
        if (t.dueDate === today) c.today++;
        if (t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd) c.week++;
        if (t.dueDate && t.dueDate < today) c.overdue++;
      }
    }
    return c;
  }, [tasks, today, weekEnd]);

  const visible = useMemo(() => {
    const text = q.trim().toLowerCase();
    return tasks.filter((t) => {
      const isOpen = t.status !== 'done';
      if (filter === 'open' && !isOpen) return false;
      if (filter === 'done' && isOpen) return false;
      if (filter === 'today' && !(isOpen && t.dueDate === today)) return false;
      if (filter === 'week' && !(isOpen && t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd)) return false;
      if (filter === 'overdue' && !(isOpen && t.dueDate && t.dueDate < today)) return false;
      if (priority !== null && t.priority !== priority) return false;
      if (category && t.category !== category) return false;
      if (text && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(text)) return false;
      return true;
    });
  }, [tasks, filter, priority, category, q, today, weekEnd]);

  const setStatus = (t: Task, status: Task['status']) => {
    const { id, ...rest } = t;
    void useTaskStore.getState().update(id!, { ...rest, status });
  };

  return (
    <div className="page">
      <PageHead title="Attività" sub={`${counts.open} aperte · ${counts.overdue} in ritardo · ${counts.done} completate`}>
        <button className="primary-btn" onClick={quick.task}>
          <IconPlus size={16} stroke={2.5} /> Nuova attività
        </button>
      </PageHead>
      {error && <div className="err">{error}</div>}

      <div className="filters">
        <div className="seg" role="group" aria-label="Filtro attività">
          {FILTERS.map(([k, label]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label} <span className="count">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="filters-right">
          <label className="search">
            <IconSearch size={15} />
            <input placeholder="Cerca attività" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select className="select" aria-label="Priorità" value={priority ?? ''} onChange={(e) => setPriority(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">Ogni priorità</option>
            {PRIORITY_LABELS.map((l, i) => (
              <option key={l} value={i}>{l}</option>
            ))}
          </select>
          <select className="select" aria-label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Ogni categoria</option>
            {TASK_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <Panel title="Elenco" sub={`${visible.length} ${visible.length === 1 ? 'attività' : 'attività'}`}>
        {visible.length === 0 ? (
          <Empty>{tasks.length === 0 ? 'Nessuna attività. Premi "Nuova attività" per creare la prima.' : 'Nessuna attività corrisponde ai filtri.'}</Empty>
        ) : (
          <div className="table">
            {visible.map((t) => {
              const overdue = t.status !== 'done' && t.dueDate && t.dueDate < today;
              return (
                <div key={t.id} className="trow" data-testid="task-row">
                  <button className={`check${t.status === 'done' ? ' on' : ''}`} aria-label={t.status === 'done' ? 'Segna da fare' : 'Segna completata'} onClick={() => void toggleTask(t)}>
                    {t.status === 'done' && <IconCheck size={14} stroke={3} />}
                  </button>
                  <button className="trow-main" onClick={() => open({ type: 'task', task: t })}>
                    <b className={t.status === 'done' ? 'strike' : ''}>{t.title}</b>
                    {t.description && <small className="muted clamp">{t.description}</small>}
                  </button>
                  <span className="tag" style={{ ['--c' as string]: PRIORITY_COLORS[t.priority] }}>{PRIORITY_LABELS[t.priority]}</span>
                  {t.category && <span className="tag plain">{t.category}</span>}
                  <span className={`due${overdue ? ' late' : ''}`}>
                    {t.dueDate ? new Date(`${t.dueDate}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + (t.dueTime ? `, ${t.dueTime}` : '') : 'Senza scadenza'}
                    {overdue ? ' · in ritardo' : ''}
                  </span>
                  <select className="select sm" aria-label="Stato" value={t.status} onChange={(e) => setStatus(t, e.target.value as Task['status'])}>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
};
