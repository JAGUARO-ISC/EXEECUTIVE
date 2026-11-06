import React, { useMemo } from 'react';
import type { Appointment } from '../../types';
import { addDays, CATEGORY_COLORS, dateKey, expandOccurrences, isSameDay, occurrencesOnDay, startOfWeek } from '../../utils/date';
import { getLinkPreview } from '../../utils/linkMetadata';

interface Props {
  date: Date;
  appointments: Appointment[];
  onDateChange: (date: Date) => void;
  onAddAppointment: (day?: Date) => void;
  onEditAppointment: (appointment: Appointment) => void;
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export const CalendarMonthView: React.FC<Props> = ({ date, appointments, onDateChange, onAddAppointment, onEditAppointment }) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const occ = useMemo(() => expandOccurrences(appointments, gridStart, addDays(gridStart, 42)), [appointments, gridStart.getTime()]);
  const today = new Date();

  return (
    <div className="month">
      <div className="month-dow">
        {DAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="month-body">
        {days.map((day) => {
          const items = occurrencesOnDay(occ, day);
          const cls = ['cell', day.getMonth() !== date.getMonth() && 'out', isSameDay(day, date) && 'sel', isSameDay(day, today) && 'today']
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={dateKey(day)}
              role="button"
              tabIndex={0}
              className={cls}
              data-testid={`day-${dateKey(day)}`}
              onClick={() => onDateChange(day)}
              onDoubleClick={() => onAddAppointment(day)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAddAppointment(day);
              }}
            >
              <span className="num">{day.getDate()}</span>
              {items.slice(0, 3).map((o, i) => (
                <button
                  key={`${o.id}-${i}`}
                  className="chip"
                  style={{ ['--c' as string]: o.color || CATEGORY_COLORS[o.category ?? 'other'] }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditAppointment(o.source);
                  }}
                >
                  <span className="chip-title">{o.title}</span>
                  {o.source.description && <span className="chip-description">{o.source.description.slice(0, 44)}</span>}
                  {o.source.link && <span className="chip-provider">{getLinkPreview(o.source.link)?.label ?? 'Link'}</span>}
                </button>
              ))}
              {items.length > 3 && <span className="more">+{items.length - 3} altri</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarMonthView;
