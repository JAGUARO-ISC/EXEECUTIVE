import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { IconAlertTriangle, IconBulb, IconCheck, IconInfoCircle, IconShieldCheck } from '@tabler/icons-react';
import { useSettings, type AdvisorInput } from '../../stores/settings';
import { useCat, useT } from '../../i18n';
import { useMoney } from '../../utils/useMoney';
import { addDays, dateKey } from '../../utils/date';
import { byCategory, inMonth, totals, ymOf } from '../../utils/finance';
import { CURRENCIES, convertMinor, formatMoney, parseMinor } from '../../utils/currency';
import { assumedRate, buildPlan, EMERGENCY_MONTHS, investMix, projectGrowth, savingsRate, spendingCuts, type Step } from '../../utils/advisor';
import { CHART_COLORS } from '../../utils/categories';
import { chartTooltip, Empty, PageHead, Panel, Progress, Stat, useChartAnim } from '../common/ui';

const TONE_ICON = { urgent: IconAlertTriangle, do: IconBulb, info: IconInfoCircle } as const;
const ALLOC_COLOR: Record<string, string> = { debt: '#f43f5e', emergency: '#3b82f6', safe: '#14b8a6', bonds: '#a78bfa', stocks: '#ff6f1a', spend: '#94a3b8' };

export const AdvisorPage: React.FC = () => {
  const { t, locale } = useT();
  const cat = useCat();
  const anim = useChartAnim();
  const { currency: appCurrency, rates, tx, skipped } = useMoney();
  const saved = useSettings((s) => s.advisor);
  const setAdvisor = useSettings((s) => s.setAdvisor);

  const [form, setForm] = useState<AdvisorInput>({ ...saved, currency: saved.currency || appCurrency });
  const [errs, setErrs] = useState<{ balance?: string }>({});
  const [flash, setFlash] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [years, setYears] = useState(10);
  const [monthlyAdd, setMonthlyAdd] = useState('');

  useEffect(() => {
    setForm({ ...saved, currency: saved.currency || appCurrency });
  }, [saved, appCurrency]);

  const cur = form.currency || appCurrency;
  const money = (minor: number) => formatMoney(minor, cur, locale);
  /** Converts an amount in the app currency into the advisor currency. */
  const toCur = (minor: number): number => convertMinor(minor, appCurrency, cur, rates) ?? (cur === appCurrency ? minor : 0);

  const balance = parseMinor(form.balance, cur) ?? 0;
  const debt = parseMinor(form.debt, cur) ?? 0;
  const manualSpend = parseMinor(form.monthlySpend, cur);
  const manualIncome = parseMinor(form.monthlyIncome, cur);

  // Spending and income from the last 3 full-or-partial months of real transactions.
  const recent = useMemo(() => {
    const now = new Date();
    const from = dateKey(addDays(new Date(now.getFullYear(), now.getMonth() - 2, 1), 0));
    const list = tx.filter((x) => x.date >= from);
    const months = new Set(list.map((x) => x.date.slice(0, 7))).size;
    return { list, months: Math.max(1, months) };
  }, [tx]);

  const autoSpend = useMemo(() => {
    const exp = recent.list.filter((x) => x.kind === 'expense').reduce((s, x) => s + x.amountCents, 0);
    return exp > 0 ? toCur(Math.round(exp / recent.months)) : 0;
  }, [recent, cur, rates]); // eslint-disable-line react-hooks/exhaustive-deps
  const autoIncome = useMemo(() => {
    const inc = recent.list.filter((x) => x.kind === 'income').reduce((s, x) => s + x.amountCents, 0);
    return inc > 0 ? toCur(Math.round(inc / recent.months)) : 0;
  }, [recent, cur, rates]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthlySpend = manualSpend ?? autoSpend;
  const monthlyIncome = manualIncome ?? autoIncome;
  const month = totals(inMonth(tx, ymOf(new Date())));
  const monthNet = month.income + month.expense > 0 ? toCur(month.net) : null;

  const plan = useMemo(
    () => buildPlan({ balance, monthlySpend, monthlyIncome, debt, horizon: form.horizon, risk: form.risk, monthNet }),
    [balance, monthlySpend, monthlyIncome, debt, form.horizon, form.risk, monthNet],
  );

  const investable = plan.allocation.filter((a) => a.key === 'safe' || a.key === 'bonds' || a.key === 'stocks').reduce((s, a) => s + a.amount, 0);
  const defaultRate = assumedRate(form.horizon, form.risk);
  const effRate = rate ?? defaultRate;
  const monthlyDefault = Math.max(0, Math.round((monthNet ?? 0) > 0 ? (monthNet as number) * 0.5 : monthlyIncome * 0.1));
  const monthlyContribution = monthlyAdd.trim() === '' ? monthlyDefault : parseMinor(monthlyAdd, cur) ?? 0;
  const growth = useMemo(() => projectGrowth(investable, monthlyContribution, effRate, years), [investable, monthlyContribution, effRate, years]);
  const last = growth[growth.length - 1];

  const cuts = useMemo(() => {
    const exp = recent.list.filter((x) => x.kind === 'expense');
    const cats = byCategory(exp, 'expense').map((c) => ({ ...c, total: toCur(c.total) }));
    return spendingCuts(cats, recent.months);
  }, [recent, cur, rates]); // eslint-disable-line react-hooks/exhaustive-deps
  const potential = cuts.reduce((s, c) => s + c.save, 0);
  const rateNow = savingsRate(month.income, month.expense);

  const set = <K extends keyof AdvisorInput>(k: K, v: AdvisorInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (form.balance.trim() !== '' && parseMinor(form.balance, cur) === null) {
      setErrs({ balance: t('common.amountInvalid') });
      return;
    }
    setErrs({});
    await setAdvisor(form);
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  };

  const stepText = (s: Step): { title: string; body: string } => {
    const amount = s.amount !== undefined ? money(s.amount) : '';
    const months = s.months !== undefined ? s.months.toFixed(1) : '';
    if (s.key === 'fund') {
      const covered = s.months ?? 0;
      const ok = covered >= EMERGENCY_MONTHS;
      return {
        title: t('adv.s.fund.t'),
        body: ok ? t('adv.s.fund.ok', { months }) : t('adv.s.fund.low', { months, target: money(s.target ?? 0), amount: money(Math.max(0, (s.target ?? 0) - balance)) }),
      };
    }
    return { title: t(`adv.s.${s.key}.t`), body: t(`adv.s.${s.key}.b`, { amount, months }) };
  };

  const allocLabel = (k: string) => t(`adv.alloc.${k}`);
  const mix = investMix(form.horizon, form.risk);

  return (
    <div className="page">
      <PageHead title={t('adv.title')} sub={t('adv.sub')} />

      <div className="notice" role="note">
        <IconShieldCheck size={18} />
        <span>{t('adv.disclaimer')}</span>
      </div>

      <div className="grid-main">
        <Panel title={t('adv.yourMoney')}>
          <div className="form-grid">
            <label className="field">
              <span>{t('adv.balance')}</span>
              <div className="input-row">
                <input className="input" inputMode="decimal" placeholder="0,00" value={form.balance} onChange={(e) => set('balance', e.target.value)} aria-invalid={!!errs.balance} data-testid="advisor-balance" />
                <select className="select" aria-label={t('adv.cur')} value={cur} onChange={(e) => set('currency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              </div>
              {errs.balance ? <small className="field-err">{errs.balance}</small> : <small className="muted">{t('adv.balanceHelp')}</small>}
            </label>

            <label className="field">
              <span>{t('adv.monthlySpend')}</span>
              <input className="input" inputMode="decimal" placeholder={autoSpend ? formatMoney(autoSpend, cur, locale) : '0,00'} value={form.monthlySpend} onChange={(e) => set('monthlySpend', e.target.value)} />
              <small className="muted">
                {manualSpend !== null ? t('adv.monthlySpendManual') : autoSpend ? t('adv.monthlySpendAuto') : t('adv.monthlySpendNone')}
                {manualSpend !== null && autoSpend > 0 && <button className="link-btn inline" onClick={() => set('monthlySpend', '')}>{t('adv.useAuto')}</button>}
              </small>
            </label>

            <label className="field">
              <span>{t('adv.monthlyIncome')}</span>
              <input className="input" inputMode="decimal" placeholder={autoIncome ? formatMoney(autoIncome, cur, locale) : '0,00'} value={form.monthlyIncome} onChange={(e) => set('monthlyIncome', e.target.value)} />
            </label>

            <label className="field">
              <span>{t('adv.debt')}</span>
              <input className="input" inputMode="decimal" placeholder="0,00" value={form.debt} onChange={(e) => set('debt', e.target.value)} />
            </label>

            <div className="field">
              <span>{t('adv.horizon')}</span>
              <div className="seg full" role="group" aria-label={t('adv.horizon')}>
                {(['short', 'mid', 'long'] as const).map((h) => (
                  <button key={h} type="button" aria-pressed={form.horizon === h} onClick={() => set('horizon', h)}>{t(`adv.h.${h}`)}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <span>{t('adv.risk')}</span>
              <div className="seg full" role="group" aria-label={t('adv.risk')}>
                {(['low', 'mid', 'high'] as const).map((r) => (
                  <button key={r} type="button" aria-pressed={form.risk === r} onClick={() => set('risk', r)}>{t(`adv.r.${r}`)}</button>
                ))}
              </div>
              <small className="muted">{t('adv.riskHelp')}</small>
            </div>
          </div>
          <div className="form-foot">
            <button className="primary-btn" onClick={() => void save()}>{flash ? <><IconCheck size={16} /> {t('adv.saved')}</> : t('adv.save')}</button>
          </div>
        </Panel>

        <div className="stack-col">
          <Stat tone="accent" label={t('adv.runway')} value={plan.months === null ? '–' : t('adv.months', { n: plan.months.toFixed(1) })} hint={<span className="muted">{plan.fundTarget ? `${t('adv.s.fund.t')}: ${money(plan.fundTarget)}` : t('adv.monthlySpendNone')}</span>} />
          <Stat label={t('adv.ruleOfThumb')} value={rateNow === null ? t('st.na') : `${rateNow}%`} hint={<span className="muted">{rateNow === null ? t('adv.yourSavingNone') : t('adv.yourSaving', { n: rateNow })}. {t('adv.ruleSub')}</span>} />
        </div>
      </div>

      {skipped > 0 && <div className="notice warn"><IconAlertTriangle size={18} /><span>{t('adv.noRatesNote')}</span></div>}

      <Panel title={t('adv.plan')}>
        {balance <= 0 ? (
          <Empty>{t('adv.planEmpty')}</Empty>
        ) : (
          <ol className="steps">
            {plan.steps.map((s, i) => {
              const Icon = TONE_ICON[s.tone];
              const x = stepText(s);
              return (
                <li key={`${s.key}-${i}`} className={`step ${s.tone}`} style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
                  <span className="step-icon"><Icon size={18} /></span>
                  <div>
                    <b>{x.title}</b>
                    <p>{x.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      {balance > 0 && plan.allocation.length > 0 && (
        <Panel title={t('adv.alloc', { amount: money(balance) })} sub={t('adv.allocNote')}>
          <div className="alloc-bar" role="img" aria-label={t('adv.alloc', { amount: money(balance) })}>
            {plan.allocation.map((a) => (
              <span key={a.key} style={{ width: `${a.pct}%`, background: ALLOC_COLOR[a.key] }} title={`${allocLabel(a.key)} ${a.pct.toFixed(0)}%`} />
            ))}
          </div>
          <div className="legend">
            {plan.allocation.map((a) => (
              <div key={a.key} className="legend-row">
                <span className="dot" style={{ background: ALLOC_COLOR[a.key] }} />
                <span>{allocLabel(a.key)}</span>
                <b>{a.pct.toFixed(0)}%</b>
                <span className="muted">{money(a.amount)}</span>
              </div>
            ))}
          </div>
          {investable > 0 && form.horizon !== 'short' && (
            <p className="muted small">{t('adv.alloc.safe')} {mix.safe}% · {t('adv.alloc.bonds')} {mix.bonds}% · {t('adv.alloc.stocks')} {mix.stocks}%</p>
          )}
        </Panel>
      )}

      <Panel title={t('adv.growth')} sub={t('adv.growthSub')}>
        <div className="form-row">
          <label className="field inline">
            <span>{t('adv.monthlyAdd')}</span>
            <input className="input" inputMode="decimal" placeholder={formatMoney(monthlyDefault, cur, locale)} value={monthlyAdd} onChange={(e) => setMonthlyAdd(e.target.value)} />
          </label>
          <label className="field inline">
            <span>{t('adv.years')}: {years}</span>
            <input type="range" min={1} max={30} value={years} onChange={(e) => setYears(Number(e.target.value))} className="range" />
          </label>
          <label className="field inline">
            <span>{t('adv.rate')}: {effRate.toFixed(1)}%</span>
            <input type="range" min={0} max={10} step={0.5} value={effRate} onChange={(e) => setRate(Number(e.target.value))} className="range" />
          </label>
        </div>
        {investable <= 0 && monthlyContribution <= 0 ? (
          <Empty>{t('adv.planEmpty')}</Empty>
        ) : (
          <>
            <div className="grid-3 tight">
              <Stat label={t('adv.final', { y: years })} value={money(last?.value ?? 0)} />
              <Stat label={t('adv.contributed')} value={money(last?.contributed ?? 0)} />
              <Stat tone="good" label={t('adv.earned')} value={money(Math.max(0, (last?.value ?? 0) - (last?.contributed ?? 0)))} />
            </div>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff6f1a" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#ff6f1a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#23252f" vertical={false} />
                  <XAxis dataKey="year" stroke="#6b6f7e" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis stroke="#6b6f7e" tickLine={false} axisLine={false} fontSize={12} width={72} tickFormatter={(v: number) => formatMoney(v, cur, locale, true)} />
                  <Tooltip {...chartTooltip} formatter={(v: number, n: string) => [money(v), n === 'value' ? t('adv.final', { y: '' }).trim() : t('adv.contributed')]} labelFormatter={(y) => `${t('adv.years')} ${y}`} />
                  <Area {...anim} type="monotone" dataKey="contributed" stroke="#6b6f7e" strokeWidth={1.5} fill="none" strokeDasharray="4 4" />
                  <Area {...anim} type="monotone" dataKey="value" stroke="#ff6f1a" strokeWidth={2} fill="url(#gv)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Panel>

      <Panel title={t('adv.saveTips')} sub={potential > 0 ? t('adv.potential', { amount: money(potential) }) : undefined}>
        {cuts.length === 0 ? (
          <Empty>{t('adv.saveTipsEmpty')}</Empty>
        ) : (
          <div className="list">
            {cuts.map((c, i) => (
              <div key={c.category} className="cat-row">
                <div className="cat-top">
                  <span>{t('adv.tip.cat', { cat: cat(c.category), pct: c.pct.toFixed(0), amount: money(toCur(c.total)), cut: c.cutPct, save: money(c.save) })}</span>
                </div>
                <Progress value={c.pct} color={CHART_COLORS[i % CHART_COLORS.length]} />
                <small className="muted">{t(tipKey(c.category))}</small>
              </div>
            ))}
            {month.expense > month.income && month.income > 0 && <p className="muted small">{t('adv.tip.over')}</p>}
          </div>
        )}
      </Panel>
    </div>
  );
};

const tipKey = (category: string): string =>
  ({
    Alimentari: 'adv.tip.food',
    Ristoranti: 'adv.tip.restaurants',
    Shopping: 'adv.tip.shopping',
    Abbonamenti: 'adv.tip.subs',
    Trasporti: 'adv.tip.transport',
    Bollette: 'adv.tip.bills',
    Carburante: 'adv.tip.fuel',
    Viaggi: 'adv.tip.travel',
  } as Record<string, string>)[category] ?? 'adv.tip.generic';
