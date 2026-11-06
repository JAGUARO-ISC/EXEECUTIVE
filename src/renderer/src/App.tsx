import React, { useEffect, useState } from 'react';
import './components/onboarding/onboarding.css';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useGoalStore, useNoteStore, useTaskStore, useTxStore } from './stores';
import { useSettings } from './stores/settings';
import { useAuth } from './stores/auth';
import { useT } from './i18n';
import { AuthPage } from './components/auth/AuthPage';
import { AdvisorPage } from './components/advisor/AdvisorPage';
import { quick, useUi } from './stores/ui';
import { Sidebar } from './components/layout/Sidebar';
import { ModalHost } from './components/common/modals';
import { CalendarPage } from './components/calendar';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { TasksPage } from './components/tasks/TasksPage';
import { FinancePage } from './components/finance/FinancePage';
import { StatsPage } from './components/stats/StatsPage';
import { NotesPage } from './components/notes/NotesPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { PageStage } from './components/layout/PageStage';
import { WelcomeIntro } from './components/onboarding/WelcomeIntro';
import { ProductTour } from './components/onboarding/ProductTour';
import { ProfileSettings } from './components/profile/ProfileSettings';
import { useTutorialStore } from './stores/tutorial';

const App: React.FC = () => {
  const page = useUi((s) => s.page);
  const setPage = useUi((s) => s.setPage);

  const { t } = useT();
  const settingsLoaded = useSettings((s) => s.loaded);
  const lang = useSettings((s) => s.lang);
  const { user, loaded: authLoaded } = useAuth((s) => ({ user: s.user, loaded: s.loaded }));
  const tutorialStatus = useTutorialStore((s) => s.status);
  const prepareTutorial = useTutorialStore((s) => s.prepare);
  const startTutorial = useTutorialStore((s) => s.start);
  const skipTutorial = useTutorialStore((s) => s.skip);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (user) {
      prepareTutorial(user.id);
      try { setShowIntro(!localStorage.getItem(`exec_intro:${user.id}`)); } catch { setShowIntro(false); }
    }
  }, [user, prepareTutorial]);

  useEffect(() => {
    void useAuth.getState().load();
    void useSettings.getState().load();
    void useTaskStore.getState().load();
    void useTxStore.getState().load();
    void useNoteStore.getState().load();
    void useGoalStore.getState().load();
  }, []);

  // System tray quick actions.
  useEffect(() => {
    const subs = [
      listen('new_appointment', () => quick.appointment()),
      listen<string>('quick_add', (e) => {
        const fn = quick[e.payload as 'task' | 'income' | 'expense' | 'note'];
        if (fn) fn();
      }),
      listen<string>('navigate', (e) => {
        if (e.payload === '/calendar') setPage('calendar');
        if (e.payload === '/settings') setPage('settings');
      }),
    ];
    return () => {
      subs.forEach((p) => void p.then((f) => f()));
    };
  }, [setPage]);

  // Keep the tray menu and the document language in sync with the app language.
  useEffect(() => {
    document.documentElement.lang = lang;
    void invoke('set_tray_labels', {
      labels: {
        open: t('tray.open'),
        new_appointment: t('quick.appointment'),
        new_task: t('quick.task'),
        new_income: t('quick.income'),
        new_expense: t('quick.expense'),
        new_note: t('quick.note'),
        calendar: t('tray.calendar'),
        settings: t('set.title'),
        quit: t('tray.quit'),
        tooltip: t('tray.tooltip'),
        notif_task_title: t('task.notifTitle'),
      },
    }).catch(() => undefined);
    void invoke('set_setting', { key: 'notif_task_title', value: t('task.notifTitle') }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, settingsLoaded]);

  const taskLoaded = useTaskStore((s) => s.loaded);
  const txLoaded = useTxStore((s) => s.loaded);
  const noteLoaded = useNoteStore((s) => s.loaded);
  const goalLoaded = useGoalStore((s) => s.loaded);
  const taskError = useTaskStore((s) => s.error);
  const txError = useTxStore((s) => s.error);
  const noteError = useNoteStore((s) => s.error);
  const goalError = useGoalStore((s) => s.error);

  const ready = settingsLoaded && taskLoaded && txLoaded && noteLoaded && goalLoaded;
  const failure = taskError || txError || noteError || goalError;

  const retry = () => {
    void useTaskStore.getState().load();
    void useTxStore.getState().load();
    void useNoteStore.getState().load();
    void useGoalStore.getState().load();
  };

  if (!authLoaded) {
    return (
      <main className="content">
        <div className="boot"><div className="boot-mark display">E</div></div>
      </main>
    );
  }

  if (!user) return <AuthPage />;

  if (showIntro) return <WelcomeIntro
    onStart={() => { try { localStorage.setItem(`exec_intro:${user.id}`, '1'); } catch { /* ignore */ } setShowIntro(false); startTutorial(user.id); }}
    onSkip={() => { try { localStorage.setItem(`exec_intro:${user.id}`, '1'); } catch { /* ignore */ } setShowIntro(false); skipTutorial(); }}
  />;

  return (
    <div className="app">
      <Sidebar />
      {failure && !ready ? (
        <main className="content">
          <div className="error-state">
            <h3>{t('common.dataErrorTitle')}</h3>
            <p>{failure}</p>
            <button className="primary-btn" onClick={retry}>{t('common.retry')}</button>
          </div>
        </main>
      ) : !ready ? (
        <main className="content">
          <div className="boot"><div className="boot-mark display">E</div></div>
        </main>
      ) : (
        <PageStage
          page={page}
          render={(p) => (
            <>
              {p === 'dashboard' && <DashboardPage />}
              {p === 'calendar' && <CalendarPage />}
              {p === 'tasks' && <TasksPage />}
              {p === 'finance' && <FinancePage />}
              {p === 'advisor' && <AdvisorPage />}
              {p === 'stats' && <StatsPage />}
              {p === 'notes' && <NotesPage />}
              {p === 'profile' && <ProfileSettings />}
              {p === 'settings' && <SettingsPage />}
            </>
          )}
        />
      )}
      <ModalHost />
      {tutorialStatus === 'running' && <ProductTour />}
    </div>
  );
};

export default App;
