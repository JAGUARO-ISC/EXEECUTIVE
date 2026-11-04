import React, { useMemo } from 'react';
import { Menu } from '@mantine/core';
import {
  IconCalendar,
  IconCalendarPlus,
  IconBulb,
  IconCash,
  IconChartBar,
  IconChecklist,
  IconLayoutDashboard,
  IconLogout,
  IconMoon,
  IconNotes,
  IconPlus,
  IconSettings,
  IconSun,
  IconTrendingDown,
  IconTrendingUp,
  IconWallet,
} from '@tabler/icons-react';
import { useTaskStore } from '../../stores';
import { useAuth } from '../../stores/auth';
import { quick, useUi, type Page } from '../../stores/ui';
import { dateKey } from '../../utils/date';
import { useT } from '../../i18n';
import { useTheme } from '../../hooks/useTheme';

const NAV: { page: Page; key: string; icon: React.ElementType }[] = [
  { page: 'dashboard', key: 'nav.dashboard', icon: IconLayoutDashboard },
  { page: 'calendar', key: 'nav.calendar', icon: IconCalendar },
  { page: 'tasks', key: 'nav.tasks', icon: IconChecklist },
  { page: 'finance', key: 'nav.finance', icon: IconWallet },
  { page: 'advisor', key: 'nav.advisor', icon: IconBulb },
  { page: 'stats', key: 'nav.stats', icon: IconChartBar },
  { page: 'notes', key: 'nav.notes', icon: IconNotes },
  { page: 'settings', key: 'nav.settings', icon: IconSettings },
];

export const Sidebar: React.FC = () => {
  const { t } = useT();
  const page = useUi((s) => s.page);
  const setPage = useUi((s) => s.setPage);
  const tasks = useTaskStore((s) => s.items);
  const { theme, toggleTheme } = useTheme();
  const overdue = useMemo(() => {
    const today = dateKey(new Date());
    return tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < today).length;
  }, [tasks]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark display">E</div>
        <div className="brand-name display">Executive</div>
      </div>

      <Menu position="bottom-start" width={220} shadow="md">
        <Menu.Target>
          <button className="new-btn" data-testid="quick-add">
            <IconPlus size={18} stroke={2.5} />
            {t('quick.new')}
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconCalendarPlus size={16} />} onClick={() => quick.appointment()}>
            {t('quick.appointment')}
          </Menu.Item>
          <Menu.Item leftSection={<IconChecklist size={16} />} onClick={quick.task}>
            {t('quick.task')}
          </Menu.Item>
          <Menu.Item leftSection={<IconTrendingUp size={16} color="#22c55e" />} onClick={quick.income}>
            {t('quick.income')}
          </Menu.Item>
          <Menu.Item leftSection={<IconTrendingDown size={16} color="#f43f5e" />} onClick={quick.expense}>
            {t('quick.expense')}
          </Menu.Item>
          <Menu.Item leftSection={<IconNotes size={16} />} onClick={quick.note}>
            {t('quick.note')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <nav className="nav-list" aria-label={t('nav.sections')}>
        <span className="nav-indicator" style={{ ['--i' as string]: Math.max(0, NAV.findIndex((n) => n.page === page)) }} aria-hidden />
        {NAV.map(({ page: p, key, icon: Icon }) => (
          <button key={p} className={`nav-item${page === p ? ' active' : ''}`} aria-current={page === p ? 'page' : undefined} onClick={() => setPage(p)}>
            <Icon size={19} stroke={1.7} />
            <span>{t(key)}</span>
            {p === 'tasks' && overdue > 0 && <em className="badge-count" title={t('nav.overdue')}>{overdue}</em>}
          </button>
        ))}
      </nav>

      <div className="side-foot">
        <IconCash size={16} />
        <span style={{ flex: 1 }}>{t('nav.localData')}</span>
        <button
          className="icon-btn flat"
          aria-label={t(theme === 'dark' ? 'theme.dark' : 'theme.light')}
          onClick={toggleTheme}
          title={t(theme === 'dark' ? 'theme.dark' : 'theme.light')}
        >
          {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
        </button>
        <button
          className="icon-btn flat"
          aria-label={t('auth.logout')}
          onClick={() => useAuth.getState().logout()}
          title={t('auth.logout')}
        >
          <IconLogout size={15} />
        </button>
      </div>
    </aside>
  );
};
