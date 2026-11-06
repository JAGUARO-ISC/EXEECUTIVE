import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { IconChevronLeft, IconChevronRight, IconSearch, IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import { useTxStore } from '../../stores';
import { quick, useUi } from '../../stores/ui';
import { byCategory, dailySeries, inMonth, shiftMonth, totals, ymOf } from '../../utils/finance';
import { useMoney } from '../../utils/useMoney';
import { CHART_COLORS, EXPENSE_COLOR, INCOME_COLOR } from '../../utils/categories';
import { useCat, useT } from '../../i18n';
import { chartTooltip, Delta, Empty, PageHead, Panel, Progress, Stat, useChartAnim } from '../common/ui';
import type { TxKind } from '../../types';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const FinancePage: React.FC = () => {
  const { t, locale } = useT();
  const cat = useCat();
  const anim = useChartAnim();
  const { tx: all, rawCount, fmt, fmtIn, skipped } = useMoney();
  const raw = useTxStore((s) => s.items);
  const error = useTxStore((s) => s.error);
  const open = useUi((s) => s.open);
  const [ym, setYm] = useState(ymOf(new Date()));
  const [kind, setKind] = useState<'all' | TxKind>('all');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');

  const monthLabel = (m: string) => cap(new Date(`${m}-01T00:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' }));

  const monthTx = useMemo(() => inMonth(all, ym), [all, ym]);
  const t0 = useMemo(() => totals(monthTx), [monthTx]);
  const p = useMemo(() => totals(inMonth(all, shiftMonth(ym, -1))), [all, ym]);
  const series = useMemo(() => dailySeries(all, ym), [all, ym]);
  const cats = useMemo(() => byCategory(monthTx, 'expense'), [monthTx]);

  // The list shows each movement in its own currency; totals above use converted amounts.
  const monthRaw = useMemo(() => raw.filter((x) => x.date.startsWith(ym)), [raw, ym]);
  const categories = useMemo(() => [...new Set(monthRaw.map((x) => x.category))].sort(), [monthRaw]);

  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    return monthRaw.filter((x) => {
      if (kind !== 'all' && x.kind !== kind) return false;
      if (category && x.category !== category) return false;
      if (text && !`${x.description ?? ''} ${x.counterparty ?? ''} ${x.category} ${x.notes ?? ''}`.toLowerCase().includes(text)) return false;
      return true;
    });
  }, [monthRaw, kind, category, q]);

  const converted = useMemo(() => new Map(all.map((x) => [x.id, x.amountCents])), [all]);

  // Group by day, newest first, with the daily total (converted to the default currency).
  const days = useMemo(() => {
    const map = new Map<string, typeof list>();
    for (const x of list) map.set(x.date, [...(map.get(x.date) ?? []), x]);
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [list]);

  const dayTotals = (items: typeof list) => totals(items.filter((x) => converted.has(x.id)).map((x) => ({ ...x, amountCents: converted.get(x.id)! })));

  const best = useMemo(() => series.reduce((m, d) => (d.expense > (m?.expense ?? 0) ? d : m), null as (typeof series)[number] | null), [series]);
  const dayLabel = (d: string) => cap(new Date(`${d}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }));
  const elapsedDays = ym === ymOf(new Date()) ? new Date().getDate() : series.length;
  const countLabel = list.length === 1 ? t('fin.moveOne') : t('fin.moveCount', { n: list.length });

  return (
    <div className="page" data-tour="finance">
      <PageHead title={t('fin.title')} sub={t('fin.sub')}>
        <div className="nav">
          <button className="icon-btn" aria-label={t('common.prevMonth')} onClick={() => setYm(shiftMonth(ym, -1))}><IconChevronLeft size={18} /></button>
          <span className="month-pill">{monthLabel(ym)}</span>
          <button className="icon-btn" aria-label={t('common.nextMonth')} onClick={() => setYm(shiftMonth(ym, 1))}><IconChevronRight size={18} /></button>
        </div>
        <button className="ghost-btn income-btn" onClick={quick.income}><IconTrendingUp size={15} /> {t('fin.income')}</button>
        <button className="primary-btn" onClick={quick.expense}><IconTrendingDown size={15} /> {t('fin.expense')}</button>
      </PageHead>
      {error && <div className="err">{error}</div>}
      {skipped > 0 && <div className="notice warn">{t('adv.noRatesNote')}</div>}

      <div className="grid-4">
        <Stat tone="accent" label={t('fin.net')} value={fmt(t0.net)} rawValue={t0.net / 100} hint={<Delta current={t0.net} previous={p.net} />} />
        <Stat label={t('fin.incomes')} value={fmt(t0.income)} rawValue={t0.income / 100} hint={<Delta current={t0.income} previous={p.income} />} />
        <Stat label={t('fin.expenses')} value={fmt(t0.expense)} rawValue={t0.expense / 100} hint={<Delta current={t0.expense} previous={p.expense} goodWhenUp={false} />} />
        <Stat
          label={t('fin.avgDay')}
          value={fmt(elapsedDays ? Math.round(t0.expense / elapsedDays) : 0)}
          rawValue={elapsedDays ? Math.round(t0.expense / elapsedDays) / 100 : 0}
          hint={<span className="muted">{best && best.expense > 0 ? t('fin.priciest', { day: best.day, amount: fmt(best.expense) }) : t('fin.noExpense')}</span>}
        />
      </div>

      <div className="grid-main">
        <Panel title={t('fin.perDay')} sub={monthLabel(ym)}>
          {monthTx.length === 0 ? (
            <Empty>{t('fin.noTx')}</Empty>
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid stroke="#23252f" vertical={false} />
                  <XAxis dataKey="day" stroke="#6b6f7e" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis stroke="#6b6f7e" tickLine={false} axisLine={false} fontSize={12} width={72} tickFormatter={(v: number) => fmt(v, true)} />
                  <Tooltip {...chartTooltip} formatter={(v: number, n: string) => [fmt(v), n === 'income' ? t('fin.incomes') : t('fin.expenses')]} labelFormatter={(d) => t('fin.day', { n: d })} />
                  <Bar {...anim} dataKey="income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={14} />
                  <Bar {...anim} dataKey="expense" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title={t('fin.where')} sub={t('fin.byCat')}>
          {cats.length === 0 ? (
            <Empty>{t('fin.noExpenses')}</Empty>
          ) : (
            <div className="list">
              {cats.slice(0, 7).map((c, i) => (
                <div key={c.category} className="cat-row">
                  <div className="cat-top">
                    <span>{cat(c.category)}</span>
                    <b>{fmt(c.total)}</b>
                  </div>
                  <Progress value={c.pct} color={CHART_COLORS[i % CHART_COLORS.length]} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title={t('fin.movements')}
        sub={countLabel}
        action={
          <div className="filters-right">
            <label className="search"><IconSearch size={15} /><input placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} /></label>
            <select className="select" aria-label={t('fin.type')} value={kind} onChange={(e) => setKind(e.target.value as 'all' | TxKind)}>
              <option value="all">{t('common.all')}</option>
              <option value="income">{t('fin.incomes')}</option>
              <option value="expense">{t('fin.expenses')}</option>
            </select>
            <select className="select" aria-label={t('common.category')} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t('common.everyCategory')}</option>
              {categories.map((c) => <option key={c} value={c}>{cat(c)}</option>)}
            </select>
          </div>
        }
      >
        {days.length === 0 ? (
          <Empty>{rawCount === 0 ? t('fin.emptyAll') : t('fin.noMatch')}</Empty>
        ) : (
          <div className="days">
            {days.map(([d, items]) => {
              const dt = dayTotals(items);
              return (
                <div key={d} className="day-group">
                  <div className="day-head">
                    <b>{dayLabel(d)}</b>
                    <span className="muted">
                      {t('fin.dayLine', { in: fmt(dt.income), out: fmt(dt.expense) })} · <b className={dt.net >= 0 ? 'pos' : 'neg'}>{t('fin.dayNet', { n: fmt(dt.net) })}</b>
                    </span>
                  </div>
                  {items.map((x) => (
                    <button key={x.id} className="tx" data-testid="tx-row" onClick={() => open({ type: 'transaction', kind: x.kind, transaction: x })}>
                      <span className={`tx-icon ${x.kind}`}>{x.kind === 'income' ? <IconTrendingUp size={16} /> : <IconTrendingDown size={16} />}</span>
                      <span className="tx-main">
                        <b>{x.description || cat(x.category)}</b>
                        <small className="muted">
                          {x.counterparty ? `${x.counterparty} · ` : ''}
                          {cat(x.category)}
                          {x.paymentMethod ? ` · ${t(`pay.${x.paymentMethod}`)}` : ''}
                        </small>
                      </span>
                      <span className={`tx-amount ${x.kind === 'income' ? 'pos' : 'neg'}`}>{x.kind === 'income' ? '+' : '−'}{fmtIn(x.amountCents, x.currency)}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
};
