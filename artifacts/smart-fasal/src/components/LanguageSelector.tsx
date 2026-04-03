import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { LANGUAGES, changeLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={t("header.language")}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-muted"
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{current.flag} {current.native}</span>
        <span className="sm:hidden">{current.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-background border border-border rounded-xl shadow-lg py-1 min-w-[160px]">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase px-3 pt-1 pb-1.5 tracking-wide">
            {t("header.language")}
          </p>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                changeLanguage(lang.code);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-muted transition-colors text-left",
                i18n.language === lang.code ? "text-primary font-semibold bg-primary/5" : "text-foreground"
              )}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <div>
                <p className="font-medium">{lang.native}</p>
                <p className="text-[10px] text-muted-foreground">{lang.label}</p>
              </div>
              {i18n.language === lang.code && (
                <span className="ml-auto text-primary text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
