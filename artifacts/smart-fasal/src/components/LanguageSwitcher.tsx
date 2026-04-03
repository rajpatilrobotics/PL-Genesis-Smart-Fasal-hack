import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const INDIAN_LANGS = [
  { code: "en", label: "English", script: "EN" },
  { code: "hi", label: "हिन्दी", script: "HI" },
  { code: "mr", label: "मराठी", script: "MR" },
  { code: "te", label: "తెలుగు", script: "TE" },
];

const GLOBAL_LANGS = [
  { code: "es", label: "Español", script: "ES" },
  { code: "fr", label: "Français", script: "FR" },
  { code: "ar", label: "العربية", script: "AR" },
  { code: "zh", label: "中文", script: "ZH" },
  { code: "pt", label: "Português", script: "PT" },
  { code: "de", label: "Deutsch", script: "DE" },
];

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language;

  const allLangs = [...INDIAN_LANGS, ...GLOBAL_LANGS];
  const current = allLangs.find((l) => l.code === currentLang) || INDIAN_LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{current.label}</span>
          <span className="sm:hidden font-bold">{current.script}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold py-1.5">
          {t("language.indian")}
        </DropdownMenuLabel>
        {INDIAN_LANGS.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`text-sm cursor-pointer ${currentLang === lang.code ? "font-bold text-primary bg-primary/5" : ""}`}
          >
            {lang.label}
            {currentLang === lang.code && (
              <span className="ml-auto text-primary text-[10px]">✓</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold py-1.5">
          {t("language.global")}
        </DropdownMenuLabel>
        {GLOBAL_LANGS.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`text-sm cursor-pointer ${currentLang === lang.code ? "font-bold text-primary bg-primary/5" : ""}`}
          >
            {lang.label}
            {currentLang === lang.code && (
              <span className="ml-auto text-primary text-[10px]">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
