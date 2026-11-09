import React, { useMemo } from 'react';
import type { Appointment } from '../../types';
import { addDays, CATEGORY_COLORS, dateKey, expandOccurrences, isSameDay, occurrencesOnDay, startOfWeek } from '../../utils/date';
import { IconCopy, IconExternalLink } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getLinkPreview } from '../../utils/linkMetadata';

interface Props {
  date: Date;
  appointments: Appointment[];
  onDateChange: (date: Date) => void;
  onAddAppointment: (day?: Date) => void;
  onEditAppointment: (appointment: Appointment) => void;
  onContextMenu?: (event: React.MouseEvent, appointment: Appointment | null, date: Date) => void;
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export const CalendarMonthView: React.FC<Props> = ({ date, appointments, onDateChange, onAddAppointment, onEditAppointment, onContextMenu }) => {
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
              onContextMenu={(event) => { event.preventDefault(); onContextMenu?.(event, null, day); }}
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
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(e, o.source, day); }}
                >
                  <span className="chip-title">{o.title}</span>
                  {o.source.description && <span className="chip-description">{o.source.description.slice(0, 44)}</span>}
                  {o.source.link && <span className="chip-provider" onClick={(e) => e.stopPropagation()}>
                    <img className="chip-favicon" src={getLinkPreview(o.source.link)?.imageUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <span>{getLinkPreview(o.source.link)?.label ?? 'Link'}</span>
                    <a href={o.source.link} target="_blank" rel="noreferrer" aria-label="Apri link" onClick={(e) => e.stopPropagation()}><IconExternalLink size={12} /></a>
                    <button type="button" aria-label="Copia link" onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(o.source.link!).then(() => notifications.show({ message: 'Link copiato', color: 'green' })); }}><IconCopy size={12} /></button>
                  </span>}
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
