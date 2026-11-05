import React, { useEffect, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { IconArrowRight, IconCheck, IconPlus } from '@tabler/icons-react';
import { toggleTask, useAppointmentStore, useGoalStore, useTaskStore } from '../../stores';
import { quick, useUi } from '../../stores/ui';
import { addDays, CATEGORY_COLORS, dateKey, expandOccurrences, formatTime, startOfDay } from '../../utils/date';
import { dailySeries, inMonth, shiftMonth, totals, ymOf } from '../../utils/finance';
import { useMoney } from '../../utils/useMoney';
import { PRIORITY_COLORS } from '../../utils/categories';
import { useT } from '../../i18n';
import { useChartAnim, chartTooltip, Delta, Empty, PageHead, Panel, Progress, Stat } from '../common/ui';
import type { Task } from '../../types';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const DashboardPage: React.FC = () => {
  const { t, locale } = useT();
  const anim = useChartAnim();
  const { tx, fmt, fmtIn } = useMoney();
  const setPage = useUi((s) => s.setPage);
  const modal = useUi((s) => s.modal);
  const open = useUi((s) => s.open);
  const tasks = useTaskStore((s) => s.items);
  const goals = useGoalStore((s) => s.items);
  const { appointments, fetchAppointments, refresh } = useAppointmentStore();

  const now = new Date();
  const today = dateKey(now);
  const ym = ymOf(now);

  useEffect(() => {
    const s = startOfDay(new Date());
    void fetchAppointments(s, addDays(s, 15));
  }, [fetchAppointments]);
  useEffect(() => {
    if (!modal) void refresh();
  }, [modal, refresh]);

  const month = useMemo(() => totals(inMonth(tx, ym)), [tx, ym]);
  const prev = useMemo(() => totals(inMonth(tx, shiftMonth(ym, -1))), [tx, ym]);
  const day = useMemo(() => totals(tx.filter((x) => x.date === today)), [tx, today]);
  const series = useMemo(() => dailySeries(tx, ym).filter((p) => p.day <= now.getDate()), [tx, ym]); // eslint-disable-line react-hooks/exhaustive-deps

  const occ = useMemo(() => {
    const s = startOfDay(new Date());
    return expandOccurrences(appointments, s, addDays(s, 15));
  }, [appointments]);
  const todayItems = occ.filter((o) => dateKey(o.occurrenceStart) === today);
  const upcoming = occ.filter((o) => o.occurrenceEnd > now).slice(0, 5);

  const open_ = tasks.filter((x) => x.status !== 'done');
  const urgent = open_.filter((x) => x.priority === 3 || (x.dueDate && x.dueDate < today));
  const todo = open_.filter((x) => !urgent.includes(x)).slice(0, 5);
  const hour = now.getHours();
  const greeting = hour < 12 ? t('dash.morning') : hour < 18 ? t('dash.afternoon') : t('dash.evening');
  const short = (d: Date) => cap(d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }));

  return (
    <div className="page">
      <PageHead title={greeting} sub={cap(now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}>
        <button className="ghost-btn" onClick={quick.expense}>{t('quick.expense')}</button>
        <button className="ghost-btn" onClick={quick.income}>{t('quick.income')}</button>
      </PageHead>

      <div className="grid-4">
        <Stat tone="accent" label={t('dash.balance')} value={fmt(month.net)} rawValue={month.net} hint={<Delta current={month.net} previous={prev.net} />} />
        <Stat label={t('dash.income')} value={fmt(month.income)} rawValue={month.income} hint={<Delta current={month.income} previous={prev.income} />} />
        <Stat label={t('dash.expense')} value={fmt(month.expense)} rawValue={month.expense} hint={<Delta current={month.expense} previous={prev.expense} goodWhenUp={false} />} />
        <Stat label={t('dash.today')} value={fmt(day.net)} rawValue={day.net} hint={<span className="muted">{t('dash.todayLine', { in: fmt(day.income), out: fmt(day.expense) })}</span>} />
      </div>

      <div className="grid-main">
        <Panel title={t('dash.trend')} sub={t('dash.trendSub')} action={<button className="link-btn" onClick={() => setPage('stats')}>{t('dash.stats')} <IconArrowRight size={14} /></button>}>
          {tx.length === 0 ? (
            <Empty>{t('dash.trendEmpty')}</Empty>
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff6f1a" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#ff6f1a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#23252f" vertical={false} />
                  <XAxis dataKey="day" stroke="#6b6f7e" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis stroke="#6b6f7e" tickLine={false} axisLine={false} fontSize={12} width={72} tickFormatter={(v: number) => fmt(v, true)} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => [fmt(v), t('st.balance')]} labelFormatter={(d) => t('fin.day', { n: d })} />
                  <Area {...anim} type="monotone" dataKey="balance" stroke="#ff6f1a" strokeWidth={2} fill="url(#bal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title={t('dash.todayAppts')} sub={t('dash.inAgenda', { n: todayItems.length })} action={<button className="icon-btn" aria-label={t('dash.newAppt')} onClick={() => quick.appointment()}><IconPlus size={16} /></button>}>
          {todayItems.length === 0 ? (
            <Empty>{t('dash.noToday')}</Empty>
          ) : (
            <div className="list">
              {todayItems.map((o, i) => (
                <button key={`${o.id}-${i}`} className="row" onClick={() => open({ type: 'appointment', appointment: o.source, date: o.occurrenceStart })}>
                  <span className="dot" style={{ background: o.color || CATEGORY_COLORS[o.category ?? 'other'] }} />
                  <span className="row-main">
                    <b>{o.title}</b>
                    <small>{formatTime(o.occurrenceStart)} - {formatTime(o.occurrenceEnd)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid-3">
        <Panel title={t('dash.upcoming')} sub={t('dash.next14')} action={<button className="link-btn" onClick={() => setPage('calendar')}>{t('dash.calendar')} <IconArrowRight size={14} /></button>}>
          {upcoming.length === 0 ? (
            <Empty>{t('dash.noUpcoming')}</Empty>
          ) : (
            <div className="list">
              {upcoming.map((o, i) => (
                <button key={`${o.id}-${i}`} className="row" onClick={() => open({ type: 'appointment', appointment: o.source, date: o.occurrenceStart })}>
                  <span className="dot" style={{ background: o.color || CATEGORY_COLORS[o.category ?? 'other'] }} />
                  <span className="row-main">
                    <b>{o.title}</b>
                    <small>{short(o.occurrenceStart)}, {formatTime(o.occurrenceStart)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t('dash.urgent')} sub={t('dash.urgentSub', { n: urgent.length })} action={<button className="link-btn" onClick={() => setPage('tasks')}>{t('dash.all')} <IconArrowRight size={14} /></button>}>
          {urgent.length === 0 ? <Empty>{t('dash.noUrgent')}</Empty> : <TaskList tasks={urgent.slice(0, 5)} today={today} />}
        </Panel>

        <Panel title={t('dash.todo')} sub={t('dash.todoSub', { n: open_.length })} action={<button className="icon-btn" aria-label={t('dash.newTask')} onClick={quick.task}><IconPlus size={16} /></button>}>
          {todo.length === 0 ? <Empty>{t('dash.todoEmpty')}</Empty> : <TaskList tasks={todo} today={today} />}
        </Panel>
      </div>

      <Panel title={t('dash.goals')} sub={t('dash.goalsSub')} action={<button className="icon-btn" aria-label={t('dash.newGoal')} onClick={quick.goal}><IconPlus size={16} /></button>}>
        {goals.length === 0 ? (
          <Empty>{t('dash.goalsEmpty')}</Empty>
        ) : (
          <div className="goal-grid">
            {goals.map((g) => {
              const pct = (g.currentCents / g.targetCents) * 100;
              const by = g.deadline ? new Date(`${g.deadline}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
              return (
                <button key={g.id} className="goal" onClick={() => open({ type: 'goal', goal: g })}>
                  <div className="goal-top">
                    <b>{g.title}</b>
                    <span>{fmtIn(g.currentCents, g.currency)} / {fmtIn(g.targetCents, g.currency)}</span>
                  </div>
                  <Progress value={pct} color={pct >= 100 ? '#22c55e' : undefined} />
                  <small className="muted">{t('dash.reached', { n: Math.min(100, Math.round(pct)) })}{by ? ` · ${t('dash.by', { date: by })}` : ''}</small>
                </button>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
};

export const TaskList: React.FC<{ tasks: Task[]; today: string }> = ({ tasks, today }) => {
  const { t, locale } = useT();
  const open = useUi((s) => s.open);
  return (
    <div className="list">
      {tasks.map((x) => {
        const late = !!x.dueDate && x.dueDate < today && x.status !== 'done';
        return (
          <div key={x.id} className="row">
            <button className={`check${x.status === 'done' ? ' on' : ''}`} aria-label={x.status === 'done' ? t('dash.markTodo') : t('dash.markDone')} onClick={() => void toggleTask(x)}>
              {x.status === 'done' && <IconCheck size={14} stroke={3} />}
            </button>
            <button className="row-main row-btn" onClick={() => open({ type: 'task', task: x })}>
              <b className={x.status === 'done' ? 'strike' : ''}>{x.title}</b>
              <small style={{ color: late ? '#fda4af' : undefined }}>
                {t(`prio.${x.priority}`)}
                {x.dueDate ? ` · ${new Date(`${x.dueDate}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}${late ? ` (${t('dash.late')})` : ''}` : ''}
              </small>
            </button>
            <span className="dot" style={{ background: PRIORITY_COLORS[x.priority] }} />
          </div>
        );
      })}
    </div>
  );
};
