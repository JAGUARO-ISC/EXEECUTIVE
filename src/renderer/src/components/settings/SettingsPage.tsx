import React, { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { IconBell, IconCheck, IconDatabaseExport, IconRefresh, IconSearch } from '@tabler/icons-react';
import { errMsg } from '../../stores';
import { useSettings, ACCENT_HEX, type AccentName } from '../../stores/settings';
import { LANGS, useT } from '../../i18n';
import { CURRENCIES } from '../../utils/currency';
import { PageHead, Panel } from '../common/ui';
import { DeviceManager } from './DeviceManager';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useTutorialStore } from '../../stores/tutorial';

const ACCENT_NAMES: AccentName[] = ['orange', 'lime', 'blue', 'violet', 'red'];

import type { Rates } from '../../utils/currency';

interface CurrencyConverterProps { rates: Rates; ratesHistory: Record<string, { date: string; rate: number }[]>; defaultCurrency: string; t: (k: string) => string; }

const CurrencyConverter: React.FC<CurrencyConverterProps> = ({ rates, ratesHistory, defaultCurrency, t }) => {
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState(defaultCurrency);
  const [to, setTo] = useState(defaultCurrency === 'USD' ? 'EUR' : 'USD');

  const result = useMemo(() => {
    const n = parseFloat(amount.replace(',', '.'));
    if (isNaN(n) || n <= 0) return null;
    const toEur = from === 'EUR' ? n : n / (rates[from] ?? NaN);
    const toTarget = to === 'EUR' ? toEur : toEur * (rates[to] ?? NaN);
    return isFinite(toTarget) ? toTarget : null;
  }, [amount, from, to, rates]);

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  return (
    <div className="conv-wrap">
      <div className="conv-row">
        <input className="input conv-amount" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.currentTarget.value)} />
        <select className="select" value={from} onChange={(e) => setFrom(e.currentTarget.value)}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </div>
      <div className="conv-eq">
        {result !== null
          ? <><b className="conv-result">{fmt(result)}</b> <span className="muted">{to}</span></>
          : amount ? <span className="muted">{t('conv.noRate')}</span> : null}
      </div>
      <div className="conv-row">
        <select className="select" value={to} onChange={(e) => setTo(e.currentTarget.value)} style={{ flex: 1 }}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </div>
      <div className="rate-chart" aria-label="Andamento del tasso di cambio">
        {(ratesHistory[to] ?? []).length > 1 ? <ResponsiveContainer width="100%" height={120}><LineChart data={ratesHistory[to]}><XAxis dataKey="date" hide /><YAxis domain={['auto', 'auto']} hide /><Tooltip /><Line type="monotone" dataKey="rate" stroke="var(--accent)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <small className="muted">Lo storico apparirà dopo più aggiornamenti.</small>}
      </div>
    </div>
  );
};

interface DbInfo {
  path: string;
  appointments: number;
  tasks: number;
  transactions: number;
  notes: number;
  goals: number;
}

const FLAG: Record<string, string> = { it: 'IT', en: 'EN', es: 'ES', fr: 'FR', de: 'DE' };

export const SettingsPage: React.FC = () => {
  const { t, locale } = useT();
  const { lang, currency, ratesDate, rates, ratesHistory, accent, setLang, setCurrency, refreshRates, setAccent } = useSettings();
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);
  const [q, setQ] = useState('');
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const restartTutorial = useTutorialStore((state) => state.restart);

  const checkForUpdate = async () => {
    setUpdateBusy(true);
    setUpdateMessage('Controllo aggiornamenti...');
    try {
      const update = await check();
      if (!update) {
        setUpdateMessage('EXEECUTIVE è aggiornato.');
        return;
      }
      setUpdateMessage(`Versione ${update.version} disponibile. Download...`);
      await update.downloadAndInstall();
      setUpdateMessage('Aggiornamento installato. Riavvio...');
      await relaunch();
    } catch (e) {
      setUpdateMessage(`Aggiornamento non disponibile: ${errMsg(e)}`);
    } finally {
      setUpdateBusy(false);
    }
  };

  const load = () => invoke<DbInfo>('db_info').then(setInfo).catch((e) => setError(errMsg(e)));
  useEffect(() => {
    void load();
  }, []);

  const backup = async () => {
    setBusy(true);
    try {
      const path = await invoke<string>('backup_database');
      setLastBackup(path);
      notifications.show({ message: t('set.backupOk'), color: 'green' });
    } catch (e) {
      setError(errMsg(e));
    }
    setBusy(false);
  };

  const updateRates = async () => {
    setRateBusy(true);
    const err = await refreshRates();
    setRateBusy(false);
    if (err) notifications.show({ message: t('set.ratesFail', { err }), color: 'red' });
    else notifications.show({ message: t('set.ratesOk'), color: 'green' });
  };

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CURRENCIES.filter((c) => !s || `${c.code} ${c.name} ${c.symbol}`.toLowerCase().includes(s));
  }, [q]);

  const dateText = ratesDate ? new Date(`${ratesDate}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const rows: [string, number | undefined][] = [
    [t('set.appts'), info?.appointments],
    [t('set.tasks'), info?.tasks],
    [t('set.tx'), info?.transactions],
    [t('set.notes'), info?.notes],
    [t('set.goals'), info?.goals],
  ];

  return (
    <div className="page narrow">
      <PageHead title={t('set.title')} sub={t('set.sub')} />
      {error && <div className="err">{error}</div>}
      <Panel title="Tutorial" sub="Rivedi la guida interattiva di EXEECUTIVE">
        <div className="backup">
          <button className="ghost-btn" onClick={restartTutorial}>Ripeti tutorial</button>
        </div>
      </Panel>
      <DeviceManager />

      <Panel title="Aggiornamenti" sub="Mantieni EXEECUTIVE aggiornato">
        <div className="backup">
          <button className="ghost-btn" disabled={updateBusy} onClick={() => void checkForUpdate()}>
            <IconRefresh size={15} className={updateBusy ? 'spin' : ''} />
            {updateBusy ? 'Controllo...' : 'Verifica aggiornamenti'}
          </button>
          {updateMessage && <small className="muted">{updateMessage}</small>}
        </div>
      </Panel>

      <Panel title={t('set.language')} sub={t('set.languageSub')}>
        <div className="choice-grid" role="radiogroup" aria-label={t('set.language')}>
          {LANGS.map((l) => (
            <button key={l.code} role="radio" aria-checked={lang === l.code} className={`choice${lang === l.code ? ' on' : ''}`} onClick={() => void setLang(l.code)}>
              <span className="choice-badge">{FLAG[l.code]}</span>
              <span>{l.name}</span>
              {lang === l.code && <IconCheck size={16} className="choice-check" />}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={t('set.currency')} sub={t('set.currencySub')}>
        <label className="search wide" style={{ marginBottom: 12 }}>
          <IconSearch size={15} />
          <input placeholder={t('set.currencySearch')} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="cur-grid" role="radiogroup" aria-label={t('set.currency')}>
          {shown.map((c) => (
            <button key={c.code} role="radio" aria-checked={currency === c.code} className={`cur${currency === c.code ? ' on' : ''}`} onClick={() => void setCurrency(c.code)}>
              <b>{c.code}</b>
              <span className="muted">{c.symbol}</span>
              <small>{c.name}</small>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={t('set.rates')} sub={t('set.ratesSub')}>
        <div className="backup">
          <button className="ghost-btn" disabled={rateBusy} onClick={() => void updateRates()}>
            <IconRefresh size={15} className={rateBusy ? 'spin' : ''} /> {rateBusy ? t('set.ratesUpdating') : t('set.ratesUpdate')}
          </button>
          <div className="muted">{dateText ? t('set.ratesDate', { date: dateText }) : t('set.ratesNever')}</div>
          <small className="muted">{t('set.ratesSource')}</small>
        </div>
      </Panel>

      <Panel title={t('set.data')} sub={t('set.dataSub')}>
        <div className="kv">
          {rows.map(([k, v]) => (
            <div key={k} className="kv-row"><span>{k}</span><b>{v ?? '-'}</b></div>
          ))}
          <div className="kv-row stack"><span>{t('set.dbPath')}</span><code>{info?.path ?? '-'}</code></div>
        </div>
      </Panel>

      <Panel title={t('set.backup')} sub={t('set.backupSub')}>
        <div className="backup">
          <button className="primary-btn" disabled={busy} onClick={() => void backup()}>
            <IconDatabaseExport size={16} /> {t('set.backupNow')}
          </button>
          {lastBackup && <div className="muted">{t('set.savedIn')} <code>{lastBackup}</code></div>}
        </div>
      </Panel>

      <Panel title={t('set.reminders')} sub={t('set.remindersSub')}>
        <div className="backup">
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>{t('set.remindersText')}</p>
          <button data-tour="notifications" className="ghost-btn" onClick={() => void invoke('show_notification', { title: 'EXEECUTIVE', body: t('set.notifTestBody') })}>
            <IconBell size={15} /> {t('set.notifTest')}
          </button>
        </div>
      </Panel>

      <Panel title={t('set.accent')} sub={t('set.accentSub')}>
        <div className="accent-grid" role="radiogroup" aria-label={t('set.accent')}>
          {ACCENT_NAMES.map((name) => (
            <button
              key={name}
              className="accent-swatch"
              style={{ ['--swatch' as string]: ACCENT_HEX[name] }}
              aria-pressed={accent === name}
              onClick={() => void setAccent(name)}
            >
              <span className="accent-dot" />
              <span>{t(`set.accent.${name}`)}</span>
              {accent === name && <IconCheck size={14} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={t('conv.title')} sub={t('conv.sub')}>
        <CurrencyConverter rates={rates} ratesHistory={ratesHistory} defaultCurrency={currency} t={t} />
      </Panel>
    </div>
  );
};
