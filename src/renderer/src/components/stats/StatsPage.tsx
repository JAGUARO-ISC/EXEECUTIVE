import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useTaskStore, useTxStore } from '../../stores';
import { byCategory, inMonth, inYear, monthlySeries, shiftMonth, totals, ymOf } from '../../utils/finance';
import { eur, eurShort } from '../../utils/money';
import { CHART_COLORS, EXPENSE_COLOR, INCOME_COLOR } from '../../utils/categories';
import { useChartAnim, chartTooltip, Delta, Empty, PageHead, Panel, Stat } from '../common/ui';

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const StatsPage: React.FC = () => {
  const anim = useChartAnim();
  const tx = useTxStore((s) => s.items);
  const tasks = useTaskStore((s) => s.items);
  const [year, setYear] = useState(new Date().getFullYear());
  const [ym, setYm] = useState(ymOf(new Date()));

  const months = useMemo(() => monthlySeries(tx, year).map((m) => ({ ...m, name: MONTHS[m.month] })), [tx, year]);
  const yt = useMemo(() => totals(inYear(tx, year)), [tx, year]);
  const mt = useMemo(() => totals(inMonth(tx, ym)), [tx, ym]);
  const pt = useMemo(() => totals(inMonth(tx, shiftMonth(ym, -1))), [tx, ym]);
  const expCats = useMemo(() => byCategory(inMonth(tx, ym), 'expense'), [tx, ym]);
  const incCats = useMemo(() => byCategory(inMonth(tx, ym), 'income'), [tx, ym]);
  const savingsRate = mt.income > 0 ? Math.round((mt.net / mt.income) * 100) : null;

  const done = tasks.filter((t) => t.status === 'done').length;
  const open = tasks.length - done;
  const monthLabel = cap(new Date(`${ym}-01T00:00:00`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }));
  const empty = tx.length === 0;

  return (
    <div className="page">
      <PageHead title="Statistiche" sub="Andamento, categorie e confronti">
        <div className="nav">
          <button className="icon-btn" aria-label="Anno precedente" onClick={() => { setYear(year - 1); setYm(`${year - 1}-${ym.slice(5)}`); }}><IconChevronLeft size={18} /></button>
          <span className="month-pill">{year}</span>
          <button className="icon-btn" aria-label="Anno successivo" onClick={() => { setYear(year + 1); setYm(`${year + 1}-${ym.slice(5)}`); }}><IconChevronRight size={18} /></button>
        </div>
      </PageHead>

      <div className="grid-4">
        <Stat tone="accent" label={`Saldo ${year}`} value={eur(yt.net)} rawValue={yt.net / 100} hint={<span className="muted">Anno in corso</span>} />
        <Stat label={`Entrate ${year}`} value={eur(yt.income)} rawValue={yt.income / 100} />
        <Stat label={`Uscite ${year}`} value={eur(yt.expense)} rawValue={yt.expense / 100} />
        <Stat label="Attività completate" value={tasks.length ? `${done} / ${tasks.length}` : '0'} hint={<span className="muted">{open} ancora aperte</span>} />
      </div>

      <Panel title={`Andamento ${year}`} sub="Entrate e uscite mese per mese">
        {empty ? (
          <Empty>Registra dei movimenti per vedere l'andamento annuale.</Empty>
        ) : (
          <div className="chart-box tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
                <CartesianGrid stroke="#23252f" vertical={false} />
                <XAxis dataKey="name" stroke="#6b6f7e" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke="#6b6f7e" tickLine={false} axisLine={false} fontSize={12} width={64} tickFormatter={(v) => eurShort(v)} />
                <Tooltip {...chartTooltip} formatter={(v: number, n: string) => [eur(v), n === 'income' ? 'Entrate' : 'Uscite']} />
                <Legend formatter={(v) => (v === 'income' ? 'Entrate' : 'Uscite')} />
                <Bar {...anim} dataKey="income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar {...anim} dataKey="expense" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Saldo mensile" sub={`Entrate meno uscite, ${year}`}>
        {empty ? (
          <Empty>Nessun dato.</Empty>
        ) : (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#23252f" vertical={false} />
                <XAxis dataKey="name" stroke="#6b6f7e" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke="#6b6f7e" tickLine={false} axisLine={false} fontSize={12} width={64} tickFormatter={(v) => eurShort(v)} />
                <Tooltip {...chartTooltip} formatter={(v: number) => [eur(v), 'Saldo']} />
                <Line {...anim} type="monotone" dataKey="net" stroke="#ff6f1a" strokeWidth={2.5} dot={{ r: 3, fill: '#ff6f1a' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="month-switch">
        <h2 className="section-title">Confronto mensile</h2>
        <div className="nav">
          <button className="icon-btn" aria-label="Mese precedente" onClick={() => setYm(shiftMonth(ym, -1))}><IconChevronLeft size={18} /></button>
          <span className="month-pill">{monthLabel}</span>
          <button className="icon-btn" aria-label="Mese successivo" onClick={() => setYm(shiftMonth(ym, 1))}><IconChevronRight size={18} /></button>
        </div>
      </div>

      <div className="grid-4">
        <Stat label="Entrate" value={eur(mt.income)} rawValue={mt.income / 100} hint={<Delta current={mt.income} previous={pt.income} />} />
        <Stat label="Uscite" value={eur(mt.expense)} rawValue={mt.expense / 100} hint={<Delta current={mt.expense} previous={pt.expense} goodWhenUp={false} />} />
        <Stat label="Saldo" value={eur(mt.net)} rawValue={mt.net / 100} hint={<Delta current={mt.net} previous={pt.net} />} />
        <Stat label="Quota risparmiata" value={savingsRate === null ? 'n.d.' : `${savingsRate}%`} rawValue={savingsRate ?? undefined} hint={<span className="muted">Saldo diviso entrate</span>} />
      </div>

      <div className="grid-2">
        <CategoryPie title="Uscite per categoria" data={expCats} />
        <CategoryPie title="Entrate per categoria" data={incCats} />
      </div>
    </div>
  );
};

const CategoryPie: React.FC<{ title: string; data: ReturnType<typeof byCategory> }> = ({ title, data }) => {
  const anim = useChartAnim();
  return (
  <Panel title={title} sub={data.length ? `${data.length} categorie` : undefined}>
    {data.length === 0 ? (
      <Empty>Nessun dato per questo mese.</Empty>
    ) : (
      <div className="pie-wrap">
        <div className="pie-box">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie {...anim} data={data} dataKey="total" nameKey="category" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none">
                {data.map((d, i) => <Cell key={d.category} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip {...chartTooltip} formatter={(v: number) => eur(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="legend">
          {data.map((d, i) => (
            <div key={d.category} className="legend-row">
              <span className="dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span>{d.category}</span>
              <b>{d.pct.toFixed(0)}%</b>
              <span className="muted">{eur(d.total)}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </Panel>
);
};
