import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { IconCheck, IconDeviceDesktop, IconLock, IconShield, IconX } from '@tabler/icons-react';
import { useDeviceStore, type Device } from '../../stores/devices';
import { useT } from '../../i18n';
import { Panel } from '../common/ui';

const statusKey = (status: Device['status']): string => ({ pending: 'set.pending', approved: 'set.approved', revoked: 'set.revoked' }[status]);

export const DeviceManager: React.FC = () => {
  const { t, locale } = useT();
  const { current, devices, loading, error, register, approve, revoke, resetLocalDevice } = useDeviceStore();
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    void register();
  }, [register]);

  useEffect(() => {
    setName(current?.device_name ?? '');
  }, [current?.device_name]);

  const saveName = async () => {
    setSavingName(true);
    try {
      await invoke('set_device_name', { name });
      await register();
    } finally {
      setSavingName(false);
    }
  };

  const reset = async () => {
    if (!window.confirm(t('set.resetDeviceConfirm'))) return;
    await resetLocalDevice();
    await register();
  };

  const date = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Panel title={t('set.devices')} sub={t('set.devicesSub')}>
      {error && <div className="err">{error}</div>}
      {current && (
        <div className="backup" style={{ gap: 12 }}>
          <div className="kv-row">
            <span><IconDeviceDesktop size={16} /> {t('set.currentDevice')}</span>
            <b>{current.device_name}{current.is_primary && <small className="muted"> · {t('set.primary')}</small>}</b>
          </div>
          <div className="backup" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <input className="input" aria-label={t('set.deviceName')} value={name} onChange={(event) => setName(event.currentTarget.value)} />
            <button className="ghost-btn" disabled={savingName || !name.trim()} onClick={() => void saveName()}>{t('set.saveDeviceName')}</button>
          </div>
          <button className="ghost-btn" onClick={() => void reset()}><IconX size={15} /> {t('set.resetDevice')}</button>
        </div>
      )}
      {!loading && devices.length === 0 && <div className="muted">{t('set.noDevices')}</div>}
      <div className="kv" style={{ marginTop: 16 }}>
        {devices.map((device) => (
          <div className="kv-row" key={device.id}>
            <span>
              {device.is_primary ? <IconShield size={16} /> : <IconDeviceDesktop size={16} />}
              {' '}{device.device_name}
              {device.id === current?.id && <small className="muted"> · {t('set.currentDevice')}</small>}
              <small className="muted"> · {t(statusKey(device.status))}</small>
              <small className="muted"> · {t('set.lastSeen', { date: date(device.last_seen_at) })}</small>
            </span>
            {current?.is_primary && current.status === 'approved' && device.id !== current.id && device.status === 'pending' && (
              <button className="ghost-btn" onClick={() => void approve(device.id)}><IconCheck size={15} /> {t('set.approveDevice')}</button>
            )}
            {current?.is_primary && current.status === 'approved' && device.id !== current.id && device.status === 'approved' && (
              <button className="ghost-btn" onClick={() => void revoke(device.id)}><IconLock size={15} /> {t('set.revokeDevice')}</button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
};
