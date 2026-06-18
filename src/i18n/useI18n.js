import { useState, useCallback, useRef, useEffect } from 'react';

// Cache for loaded locales
const localeCache = {};

function loadLocale(locale) {
  if (localeCache[locale]) return Promise.resolve(localeCache[locale]);
  
  let lang = locale;
  // Map locale codes to filenames - support browser locale formats
  if (locale.startsWith('zh')) lang = 'zh-CN';
  else lang = 'en-US';
  
  return import(`./${lang}.json`).then(module => {
    localeCache[locale] = module.default || module;
    return localeCache[locale];
  });
}

// Detect system language
export function detectSystemLocale(fallback = 'en-US') {
  // Browser/Electron system language detection
  const lang = navigator.language || navigator.userLanguage || fallback;
  if (lang.startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

// Deep get: safely access nested keys like "nav.mods"
function deepGet(obj, path) {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

// Simple template: replace {key} with values from params
function template(str, params) {
  if (!str || !params) return str || '';
  return str.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? params[key] : match;
  });
}

export default function useI18n(initialLocale) {
  const [locale, setLocaleState] = useState(initialLocale || detectSystemLocale());
  const [messages, setMessages] = useState(null);
  const loadedLocaleRef = useRef(null);

  const loadMessages = useCallback((loc) => {
    if (loadedLocaleRef.current === loc && messages) return;
    loadLocale(loc).then(msgs => {
      setMessages(msgs);
      loadedLocaleRef.current = loc;
    });
  }, [messages]);

  useEffect(() => {
    loadMessages(locale);
  }, [locale, loadMessages]);

  const changeLocale = useCallback((newLocale) => {
    setLocaleState(newLocale);
    localStorage.setItem('sts2-locale', newLocale);
  }, []);

  // t(key, params?) — translate a key with optional interpolation
  const t = useCallback((key, params) => {
    if (!messages) return key;
    const value = deepGet(messages, key);
    if (value === undefined) return key;
    return template(value, params);
  }, [messages]);

  return { locale, messages, t, changeLocale, ready: messages !== null };
}