import { Link, useLocation } from "wouter";
import { Home, Brain, ShoppingCart, Sparkles, UserCircle2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function BottomNav() {
  const [location] = useLocation();
  const { t } = useTranslation();

  const links = [
    { href: "/", icon: Home, label: t("nav.home") },
    { href: "/ai", icon: Brain, label: t("nav.aiHub") },
    { href: "/market", icon: ShoppingCart, label: t("nav.market") },
    { href: "/web3", icon: Sparkles, label: t("nav.web3") },
    { href: "/finance", icon: Wallet, label: t("nav.finance") },
    { href: "/profile", icon: UserCircle2, label: t("nav.profile") },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Gradient fade above nav */}
      <div className="h-6 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
      <div className="bg-white/90 dark:bg-card/95 backdrop-blur-2xl border-t border-border/60 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.08)]">
        <div className="container mx-auto px-1 max-w-md">
          <nav className="flex items-center justify-between h-16 px-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 relative"
                >
                  {/* Active indicator dot */}
                  {isActive && (
                    <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-4 h-[3px] rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm" />
                  )}

                  <div className={cn(
                    "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200",
                    isActive
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}>
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-br from-emerald-100 to-teal-100 shadow-sm"
                        : "hover:bg-muted/60"
                    )}>
                      <Icon
                        className={cn(
                          "transition-all duration-200",
                          isActive ? "w-[18px] h-[18px]" : "w-4 h-4"
                        )}
                        strokeWidth={isActive ? 2.5 : 1.8}
                      />
                    </div>
                    <span className={cn(
                      "text-[10px] leading-none transition-all duration-200",
                      isActive ? "font-bold text-emerald-700 dark:text-emerald-400" : "font-medium"
                    )}>
                      {link.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
