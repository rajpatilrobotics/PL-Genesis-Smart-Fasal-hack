import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import hi from "./locales/hi.json";
import mr from "./locales/mr.json";
import te from "./locales/te.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import ar from "./locales/ar.json";
import zh from "./locales/zh.json";
import pt from "./locales/pt.json";
import de from "./locales/de.json";

const STORAGE_KEY = "smart-fasal-lang";

const savedLang = localStorage.getItem(STORAGE_KEY) || "en";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
      te: { translation: te },
      es: { translation: es },
      fr: { translation: fr },
      ar: { translation: ar },
      zh: { translation: zh },
      pt: { translation: pt },
      de: { translation: de },
    },
    lng: savedLang,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  const isRTL = lng === "ar";
  document.documentElement.dir = isRTL ? "rtl" : "ltr";
  document.documentElement.lang = lng;
});

const initialIsRTL = savedLang === "ar";
document.documentElement.dir = initialIsRTL ? "rtl" : "ltr";
document.documentElement.lang = savedLang;

export default i18n;
