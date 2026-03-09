import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zh from './locales/zh.json';
import en from './locales/en.json';
import ru from './locales/ru.json';

const resources = {
  zh: { 
    translation: zh,
  },
  en: { 
    translation: en,
  },
  ru: { 
    translation: ru,
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng:'zh',
    debug: false,
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;