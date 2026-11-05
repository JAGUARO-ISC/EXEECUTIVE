import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './styles/global.css';
import './styles/pages.css';
import './styles/motion.css';
import './components/auth/auth.css';
import App from './App';
import { reportRuntimeConfig, runtimeConfig } from './lib/runtimeConfig';
import { theme } from './theme';

reportRuntimeConfig(runtimeConfig);

// Apply persisted theme before first paint to avoid flash
try {
  const t = localStorage.getItem('exec_theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
} catch { /* private window, ignore */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
