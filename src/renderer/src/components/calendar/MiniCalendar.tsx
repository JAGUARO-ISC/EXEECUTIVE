import React, { useMemo } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { Appointment } from '../../types';
import { addDays, addMonthsClamped, dateKey, expandOccurrences, isSameDay, occurrencesOnDay, startOfWeek } from '../../utils/date';

interface Props {
  date: Date;
  appointments: Appointment[];
  onSelect: (d: Date) => void;
}

const DOW = ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'];

export const MiniCalendar: React.FC<Props> = ({ date, appointments, onSelect }) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const occ = useMemo(() => expandOccurrences(appointments, start, addDays(start, 42)), [appointments, start.getTime()]);
  const today = new Date();

  return (
    <div className="mini">
      <div className="mini-head">
        <strong className="display">
          {date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </strong>
        <span style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" aria-label="Mese precedente" onClick={() => onSelect(addMonthsClamped(date, -1))}>
            <IconChevronLeft size={16} />
          </button>
          <button className="icon-btn" aria-label="Mese successivo" onClick={() => onSelect(addMonthsClamped(date, 1))}>
            <IconChevronRight size={16} />
          </button>
        </span>
      </div>
      <div className="mini-grid">
        {DOW.map((d) => (
          <div key={d} className="mini-dow">{d}</div>
        ))}
        {days.map((d) => {
          const count = occurrencesOnDay(occ, d).length;
          const cls = ['mini-day', d.getMonth() !== date.getMonth() && 'out', isSameDay(d, date) && 'sel', isSameDay(d, today) && 'today']
            .filter(Boolean)
            .join(' ');
          return (
            <button key={dateKey(d)} className={cls} onClick={() => onSelect(d)} aria-label={d.toDateString()}>
              {d.getDate()}
              {count > 0 && (
                <span className="dots">
                  {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
