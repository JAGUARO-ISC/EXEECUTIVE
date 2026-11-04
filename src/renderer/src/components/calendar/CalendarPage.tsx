import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react';
import { useAppointmentStore } from '../../stores';
import { useUi } from '../../stores/ui';
import type { Appointment, CalendarView } from '../../types';
import { addDays, addMonthsClamped, CATEGORY_COLORS, expandOccurrences, formatTime, startOfDay, startOfWeek } from '../../utils/date';
import { CalendarDayView } from './CalendarDayView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarYearView } from './CalendarYearView';
import { MiniCalendar } from './MiniCalendar';
import { Swap, type SwapVariant } from '../common/Swap';

const VIEW_LABEL: Record<CalendarView, string> = { day: 'Giorno', week: 'Settimana', month: 'Mese', year: 'Anno' };
const LOCALE = 'it-IT';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Visible range for a view (padded for the month grid). */
const rangeFor = (view: CalendarView, d: Date): [Date, Date] => {
  switch (view) {
    case 'day': {
      const s = startOfDay(d);
      return [s, addDays(s, 1)];
    }
    case 'week': {
      const s = startOfWeek(d);
      return [s, addDays(s, 7)];
    }
    case 'month': {
      const s = startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1));
      return [s, addDays(s, 42)];
    }
    case 'year':
      return [new Date(d.getFullYear(), 0, 1), new Date(d.getFullYear() + 1, 0, 1)];
  }
};

const shift = (view: CalendarView, d: Date, dir: 1 | -1): Date => {
  switch (view) {
    case 'day':
      return addDays(d, dir);
    case 'week':
      return addDays(d, 7 * dir);
    case 'month':
      return addMonthsClamped(d, dir);
    case 'year':
      return new Date(d.getFullYear() + dir, d.getMonth(), 1);
  }
};

const title = (view: CalendarView, d: Date): { main: string; sub: string } => {
  switch (view) {
    case 'day':
      return { main: cap(d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })), sub: String(d.getFullYear()) };
    case 'week': {
      const s = startOfWeek(d);
      const e = addDays(s, 6);
      const f = (x: Date) => x.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
      return { main: `${f(s)} - ${f(e)}`, sub: String(e.getFullYear()) };
    }
    case 'month':
      return { main: cap(d.toLocaleDateString(LOCALE, { month: 'long' })), sub: String(d.getFullYear()) };
    case 'year':
      return { main: String(d.getFullYear()), sub: '' };
  }
};

export const CalendarPage: React.FC = () => {
  const [view, setView] = useState<CalendarView>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const open = useUi((s) => s.open);
  const modal = useUi((s) => s.modal);
  const prevDate = useRef(selectedDate);
  const prevView = useRef(view);
  const variant: SwapVariant = (() => {
    if (prevView.current !== view) return 'view';
    const d = selectedDate.getTime() - prevDate.current.getTime();
    return d > 0 ? 'next' : d < 0 ? 'prev' : 'view';
  })();
  const { appointments, fetchAppointments, refresh, error } = useAppointmentStore();

  const key = `${view}-${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
  // Month and year views only change visually when the month/year changes, not on every day click.
  const animKey = view === 'month' ? `${view}-${selectedDate.getFullYear()}-${selectedDate.getMonth()}` : view === 'year' ? `${view}-${selectedDate.getFullYear()}` : view === 'week' ? `${view}-${startOfWeek(selectedDate).getTime()}` : key;
  useEffect(() => {
    prevDate.current = selectedDate;
    prevView.current = view;
  }, [selectedDate, view]);
  useEffect(() => {
    // The side panel needs the visible month, so widen the range to the union.
    const [s, e] = rangeFor(view, selectedDate);
    const [ms, me] = rangeFor('month', selectedDate);
    void fetchAppointments(s < ms ? s : ms, e > me ? e : me);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fetchAppointments]);

  // Reload after a modal (opened from the sidebar or the tray) closes.
  useEffect(() => {
    if (!modal) void refresh();
  }, [modal, refresh]);

  const openNew = useCallback(
    (day?: Date) => {
      const start = new Date(day ?? selectedDate);
      if (start.getHours() === 0 && start.getMinutes() === 0) start.setHours(9, 0, 0, 0);
      open({ type: 'appointment', appointment: null, date: start });
    },
    [open, selectedDate],
  );

  const openEdit = useCallback((a: Appointment) => open({ type: 'appointment', appointment: a, date: new Date(a.startDatetime) }), [open]);

  const dayItems = useMemo(() => {
    const s = startOfDay(selectedDate);
    return expandOccurrences(appointments, s, addDays(s, 1));
  }, [appointments, selectedDate]);

  const common = { date: selectedDate, appointments, onDateChange: setSelectedDate, onAddAppointment: openNew, onEditAppointment: openEdit };
  const t = title(view, selectedDate);

  return (
    <div className="cal-layout">
      <div className="cal-main">
        <div className="toolbar">
          <div className="toolbar-left">
            <h1 className="period">
              {t.main} <span>{t.sub}</span>
            </h1>
            <div className="nav">
              <button className="icon-btn" aria-label="Precedente" onClick={() => setSelectedDate(shift(view, selectedDate, -1))}>
                <IconChevronLeft size={18} />
              </button>
              <button className="icon-btn" aria-label="Successivo" onClick={() => setSelectedDate(shift(view, selectedDate, 1))}>
                <IconChevronRight size={18} />
              </button>
            </div>
            <button className="ghost-btn" onClick={() => setSelectedDate(new Date())}>
              Oggi
            </button>
          </div>
          <div className="seg" role="group" aria-label="Vista calendario">
            {(['day', 'week', 'month', 'year'] as CalendarView[]).map((v) => (
              <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="err">{error}</div>}
        <div className="stage">
          <Swap key={animKey} variant={variant}>
            {view === 'day' && <CalendarDayView {...common} />}
            {view === 'week' && <CalendarWeekView {...common} />}
            {view === 'month' && <CalendarMonthView {...common} />}
            {view === 'year' && (
              <CalendarYearView
                date={selectedDate}
                appointments={appointments}
                onDateChange={setSelectedDate}
                onSelectMonth={(d) => {
                  setSelectedDate(d);
                  setView('month');
                }}
              />
            )}
          </Swap>
        </div>
      </div>

      <aside className="cal-side">
        <MiniCalendar date={selectedDate} appointments={appointments} onSelect={setSelectedDate} />
        <div>
          <div className="side-row">
            <h3 className="side-title">{cap(selectedDate.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>
            <button className="icon-btn" aria-label="Nuovo appuntamento" onClick={() => openNew(selectedDate)}>
              <IconPlus size={16} />
            </button>
          </div>
          <div className="upcoming">
            {dayItems.length === 0 && <div className="empty">Nessun impegno. Premi + per aggiungerne uno.</div>}
            {dayItems.map((o, i) => (
              <button key={`${o.id}-${i}`} className="up-item" style={{ ['--c' as string]: o.color || CATEGORY_COLORS[o.category ?? 'other'] }} onClick={() => openEdit(o.source)}>
                <span className="up-bar" />
                <span>
                  <div className="up-title">{o.title}</div>
                  <div className="up-time">
                    {formatTime(o.occurrenceStart)} - {formatTime(o.occurrenceEnd)}
                    {o.location ? `, ${o.location}` : ''}
                  </div>
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default CalendarPage;
