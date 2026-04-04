import { Link, useLocation } from "wouter";
import { Home, Brain, ShoppingCart, Sparkles, Wallet, UserCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function BottomNav() {
  const [location] = useLocation();
  const { t } = useTranslation();

  const links = [
    { href: "/",          icon: Home,        label: t("nav.home") },
    { href: "/ai",        icon: Brain,       label: t("nav.aiHub") },
    { href: "/market",    icon: ShoppingCart,label: t("nav.market") },
    { href: "/community", icon: Users,       label: t("nav.community") },
    { href: "/web3",      icon: Sparkles,    label: t("nav.web3") },
    { href: "/finance",   icon: Wallet,      label: t("nav.finance") },
    { href: "/profile",   icon: UserCircle2, label: t("nav.profile") },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Soft fade above the bar */}
      <div className="h-8 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />

      <div className="bg-white/80 backdrop-blur-2xl border-t border-emerald-100/80 shadow-[0_-4px_24px_rgba(0,0,0,0.07)]">
        <div className="container mx-auto max-w-md">
          <nav className="flex items-center justify-around h-[62px] px-0">
            {links.map(({ href, icon: Icon, label }) => {
              const isActive = location === href;

              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center justify-center flex-1 h-full relative group min-w-0"
                >
                  {/* Floating pill for active */}
                  <div className={cn(
                    "flex flex-col items-center gap-[3px] px-1.5 py-1.5 rounded-2xl transition-all duration-300",
                    isActive
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200"
                      : "hover:bg-emerald-50/70"
                  )}>
                    <Icon
                      className={cn(
                        "transition-all duration-300 shrink-0",
                        isActive
                          ? "w-[18px] h-[18px] text-white"
                          : "w-[18px] h-[18px] text-slate-400 group-hover:text-emerald-600"
                      )}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                    <span className={cn(
                      "text-[9px] leading-none font-semibold transition-all duration-300 text-center",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-emerald-600"
                    )}>
                      {label}
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
