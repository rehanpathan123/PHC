import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const I18nContext = createContext();

export function I18nProvider({ children }) {
  // Try to load from localStorage, default to English
  const [locale, setLocale] = useState(() => {
    return localStorage.getItem('phcsync_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('phcsync_lang', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const t = (key) => {
    const dict = translations[locale] || translations['en'];
    return dict[key] || translations['en'][key] || key;
  };

  const changeLanguage = (lang) => {
    if (translations[lang]) {
      setLocale(lang);
    }
  };

  return (
    <I18nContext.Provider value={{ locale, t, changeLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
