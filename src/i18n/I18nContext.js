import React, { createContext, useContext, useEffect } from 'react';
import useI18n, { detectSystemLocale } from './useI18n';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  // Read saved locale from localStorage, or detect system language
  const savedLocale = localStorage.getItem('sts2-locale');
  const initialLocale = savedLocale || detectSystemLocale();
  
  const i18n = useI18n(initialLocale);
  
  // Save locale to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sts2-locale', i18n.locale);
  }, [i18n.locale]);

  return (
    <I18nContext.Provider value={i18n}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback: return key as-is if no context
    return { t: (key) => key, locale: 'en-US', changeLocale: () => {} };
  }
  return ctx;
}

export default I18nContext;