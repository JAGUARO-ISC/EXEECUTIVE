import React from 'react';
import { useReducedMotion } from '@mantine/hooks';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';
import { pctChange } from '../../utils/finance';
import { useT } from '../../i18n';
import { formatCountUpValue, useCountUp } from '../../hooks/useCountUp';

export const PageHead: React.FC<{ title: string; sub?: string; children?: React.ReactNode }> = ({ title, sub, children }) => (
  <div className="page-head">
    <div>
      <h1 className="page-title">{title}</h1>
      {sub && <div className="page-sub">{sub}</div>}
    </div>
    <div className="page-actions">{children}</div>
  </div>
);

export const Panel: React.FC<{ title: string; sub?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  title,
  sub,
  action,
  className = '',
  children,
}) => (
  <section className={`panel ${className}`}>
    <header className="panel-head">
      <div>
        <h3 className="panel-title">{title}</h3>
        {sub && <div className="panel-sub">{sub}</div>}
      </div>
      {action}
    </header>
    {children}
  </section>
);

export const Stat: React.FC<{
  label: string;
  value: string;
  rawValue?: number;
  hint?: React.ReactNode;
  tone?: 'plain' | 'accent' | 'good' | 'bad';
}> = ({ label, value, rawValue, hint, tone = 'plain' }) => {
  const animated = useCountUp(rawValue ?? 0, 900);
  const displayValue = rawValue !== undefined ? formatCountUpValue(value, animated) : value;
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value display">{displayValue}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
};

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="empty-box">{children}</div>;

/** Percent change chip. `goodWhenUp` flips the colors for costs. */
export const Delta: React.FC<{ current: number; previous: number; goodWhenUp?: boolean; suffix?: string }> = ({
  current,
  previous,
  goodWhenUp = true,
  suffix,
}) => {
  const { t } = useT();
  const p = pctChange(current, previous);
  if (p === null) return <span className="muted">{t('common.noLastMonth')}</span>;
  const up = p >= 0;
  const good = up === goodWhenUp;
  const animated = useCountUp(Math.abs(p), 700);
  return (
    <span className={good ? 'delta good' : 'delta bad'}>
      {up ? <IconArrowUpRight size={14} /> : <IconArrowDownRight size={14} />}
      {animated.toFixed(1).replace('.', ',')}% <span className="muted">{suffix ?? t('common.vsLastMonth')}</span>
    </span>
  );
};

export const Progress: React.FC<{ value: number; color?: string }> = ({ value, color = 'var(--accent)' }) => (
  <div className="bar">
    <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
  </div>
);

export const chartTooltip = {
  contentStyle: { background: '#16171e', border: '1px solid #2a2c36', borderRadius: 12, color: '#f2f3f7', fontSize: 12 },
  labelStyle: { color: '#8b8f9e' },
  cursor: { fill: 'rgba(255,255,255,0.04)' },
};

/** Shared chart animation: 500ms ease-out, off when the system asks for reduced motion. */
export const useChartAnim = () => {
  const reduced = useReducedMotion();
  return { isAnimationActive: !reduced, animationDuration: 500, animationEasing: 'ease-out' as const };
};
