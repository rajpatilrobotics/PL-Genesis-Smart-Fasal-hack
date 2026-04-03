import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en";
import hi from "./locales/hi";
import te from "./locales/te";
import mr from "./locales/mr";
import es from "./locales/es";
import fr from "./locales/fr";
import ar from "./locales/ar";
import pt from "./locales/pt";
import sw from "./locales/sw";

const LANG_KEY = "sf_language";

const savedLang = localStorage.getItem(LANG_KEY) || "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    te: { translation: te },
    mr: { translation: mr },
    es: { translation: es },
    fr: { translation: fr },
    ar: { translation: ar },
    pt: { translation: pt },
    sw: { translation: sw },
  },
  lng: savedLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export const LANGUAGES = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "hi", label: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { code: "te", label: "Telugu", native: "తెలుగు", flag: "🇮🇳" },
  { code: "mr", label: "Marathi", native: "मराठी", flag: "🇮🇳" },
  { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "fr", label: "French", native: "Français", flag: "🇫🇷" },
  { code: "ar", label: "Arabic", native: "العربية", flag: "🇸🇦" },
  { code: "pt", label: "Portuguese", native: "Português", flag: "🇧🇷" },
  { code: "sw", label: "Swahili", native: "Kiswahili", flag: "🇰🇪" },
];

export function changeLanguage(code: string) {
  i18n.changeLanguage(code);
  localStorage.setItem(LANG_KEY, code);
  document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
}

export default i18n;
