import React, { useMemo } from 'react';
import type { Appointment } from '../../types';
import { addDays, dateKey, expandOccurrences, isSameDay, startOfWeek } from '../../utils/date';

interface Props {
  date: Date;
  appointments: Appointment[];
  onDateChange: (date: Date) => void;
  onSelectMonth: (date: Date) => void;
}

export const CalendarYearView: React.FC<Props> = ({ date, appointments, onSelectMonth }) => {
  const year = date.getFullYear();
  const occ = useMemo(() => expandOccurrences(appointments, new Date(year, 0, 1), new Date(year + 1, 0, 1)), [appointments, year]);
  const busy = useMemo(() => new Set(occ.map((o) => dateKey(o.occurrenceStart))), [occ]);
  const now = new Date();

  return (
    <div className="year">
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1);
        const start = startOfWeek(first);
        const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
        const count = occ.filter((o) => o.occurrenceStart.getMonth() === m && o.occurrenceStart.getFullYear() === year).length;
        const current = now.getFullYear() === year && now.getMonth() === m;
        return (
          <button key={m} className={`ymonth${current ? ' cur' : ''}`} onClick={() => onSelectMonth(first)}>
            <h4>{first.toLocaleDateString('it-IT', { month: 'long' })}</h4>
            <div className="ygrid">
              {cells.map((d) => {
                const inMonth = d.getMonth() === m;
                if (!inMonth) return <span key={dateKey(d)} className="d" />;
                const cls = ['d', busy.has(dateKey(d)) && 'has', isSameDay(d, now) && 't'].filter(Boolean).join(' ');
                return (
                  <span key={dateKey(d)} className={cls}>
                    {d.getDate()}
                  </span>
                );
              })}
            </div>
            <div className="ycount">{count === 0 ? 'Nessun appuntamento' : `${count} appuntament${count > 1 ? 'i' : 'o'}`}</div>
          </button>
        );
      })}
    </div>
  );
};

export default CalendarYearView;
