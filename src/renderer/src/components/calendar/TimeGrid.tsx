import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Appointment } from '../../types';
import {
  addDays,
  CATEGORY_COLORS,
  dateKey,
  expandOccurrences,
  formatRange,
  isSameDay,
  layoutLanes,
  occurrencesOnDay,
} from '../../utils/date';

interface Props {
  days: Date[];
  appointments: Appointment[];
  onAddAppointment: (day?: Date) => void;
  onEditAppointment: (appointment: Appointment) => void;
}

const HOUR_PX = 64;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const hourLabel = (h: number) => (h === 0 ? '' : new Date(2000, 0, 1, h).toLocaleTimeString('it-IT', { hour: 'numeric' }));

/** Shared by the day view (1 column) and the week view (7 columns). */
export const TimeGrid: React.FC<Props> = ({ days, appointments, onAddAppointment, onEditAppointment }) => {
  const from = days[0];
  const to = addDays(days[days.length - 1], 1);
  const occ = useMemo(() => expandOccurrences(appointments, from, to), [appointments, from.getTime(), to.getTime()]);
  const [now, setNow] = useState(new Date());
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * HOUR_PX;
  }, []);

  return (
    <div className="tg">
      <div className="tg-head">
        <div className="tg-gutter" />
        {days.map((d) => (
          <div key={dateKey(d)} className={`tg-col-head${isSameDay(d, now) ? ' today' : ''}`}>
            {d.toLocaleDateString('it-IT', { weekday: 'short' })}
            <b>{d.getDate()}</b>
          </div>
        ))}
      </div>
      <div className="tg-scroll" ref={scroller}>
        <div className="tg-body" style={{ height: HOUR_PX * 24 }}>
          <div className="tg-hours">
            {HOURS.map((h) => (
              <span key={h} style={{ top: h * HOUR_PX }}>
                {hourLabel(h)}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const dayEnd = addDays(dayStart, 1);
            const lanes = layoutLanes(occurrencesOnDay(occ, d));
            return (
              <div key={dateKey(d)} className="tg-col">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="tg-line"
                    style={{ top: h * HOUR_PX, height: HOUR_PX }}
                    onClick={() => {
                      const s = new Date(d);
                      s.setHours(h, 0, 0, 0);
                      onAddAppointment(s);
                    }}
                  />
                ))}
                {isSameDay(d, now) && (
                  <div className="now-line" style={{ top: ((now.getTime() - dayStart.getTime()) / 3600000) * HOUR_PX }} />
                )}
                {lanes.map(({ o, lane, lanes: n }, i) => {
                  const s = o.occurrenceStart < dayStart ? dayStart : o.occurrenceStart;
                  const e = o.occurrenceEnd > dayEnd ? dayEnd : o.occurrenceEnd;
                  const top = ((s.getTime() - dayStart.getTime()) / 3600000) * HOUR_PX;
                  const height = Math.max(26, ((e.getTime() - s.getTime()) / 3600000) * HOUR_PX - 2);
                  return (
                    <button
                      key={`${o.id}-${i}`}
                      className="ev"
                      style={{
                        ['--c' as string]: o.color || CATEGORY_COLORS[o.category ?? 'other'],
                        top,
                        height,
                        left: `calc(${(lane / n) * 100}% + 3px)`,
                        width: `calc(${100 / n}% - 6px)`,
                      }}
                      onClick={() => onEditAppointment(o.source)}
                    >
                      <span className="ev-time">{formatRange(o.occurrenceStart, o.occurrenceEnd)}</span>
                      <div className="ev-title">{o.title}</div>
                      {height > 70 && o.location && <div className="ev-sub">{o.location}</div>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
