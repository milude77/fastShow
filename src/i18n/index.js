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

const getSettingsLanguage = async () => {
  const language = await window.electronAPI.getSettingsValue('language');
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      lng: language,
      debug: false,
      interpolation: {
        escapeValue: false
      },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage']
      }
    });
}

getSettingsLanguage();

export default i18n;