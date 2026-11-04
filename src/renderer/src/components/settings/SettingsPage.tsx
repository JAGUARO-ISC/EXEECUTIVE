import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconDatabaseExport, IconRefresh, IconSearch } from '@tabler/icons-react';
import { errMsg } from '../../stores';
import { useSettings } from '../../stores/settings';
import { LANGS, useT } from '../../i18n';
import { CURRENCIES } from '../../utils/currency';
import { PageHead, Panel } from '../common/ui';

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
  const { lang, currency, ratesDate, setLang, setCurrency, refreshRates } = useSettings();
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rateBusy, setRateBusy] = useState(false);
  const [q, setQ] = useState('');

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
        <p className="muted pad">{t('set.remindersText')}</p>
      </Panel>
    </div>
  );
};
