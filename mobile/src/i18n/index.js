import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

const SUPPORTED = ['en', 'fr'];

// Detect saved language (localStorage on web, falls back to device locale)
function detectLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('shopmaster_language');
      if (saved && SUPPORTED.includes(saved)) return saved;
    }
  } catch {}
  try {
    const deviceLang = (navigator?.language ?? 'en').split('-')[0];
    if (SUPPORTED.includes(deviceLang)) return deviceLang;
  } catch {}
  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export function changeLanguage(lang) {
  i18n.changeLanguage(lang);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('shopmaster_language', lang);
    }
  } catch {}
}

export default i18n;
