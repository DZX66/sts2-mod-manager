import './tauri-api';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n/I18nContext';
import './index.css';

// Initialize theme before rendering
(function initTheme() {
  const theme = localStorage.getItem('sts2-theme') || 'system';
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (theme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', prefersDark);
  }
  // Listen for system theme changes in "system" mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const saved = localStorage.getItem('sts2-theme');
    if (!saved || saved === 'system') {
      document.documentElement.classList.toggle('dark', e.matches);
    }
  });
})();

const root = createRoot(document.getElementById('root'));
root.render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
