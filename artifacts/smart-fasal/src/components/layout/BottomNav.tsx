import { Link, useLocation } from "wouter";
import { Home, Brain, Shield, ShoppingCart, Sparkles, UserCircle2, BadgeIndianRupee, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const [location] = useLocation();

  const links = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/ai", icon: Brain, label: "AI Hub" },
    { href: "/insurance", icon: Shield, label: "Insurance" },
    { href: "/market", icon: ShoppingCart, label: "Market" },
    { href: "/community", icon: Users, label: "Community" },
    { href: "/web3", icon: Sparkles, label: "Web3" },
    { href: "/credit", icon: BadgeIndianRupee, label: "Credit" },
    { href: "/profile", icon: UserCircle2, label: "Profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-t border-border">
      <div className="container mx-auto px-1 max-w-md">
        <nav className="flex items-center justify-between h-16">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full space-y-0.5 text-[10px] font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid={`nav-${link.label.toLowerCase().replace(" ", "-")}`}
              >
                <div className={cn(
                  "p-1 rounded-full transition-all duration-300",
                  isActive ? "bg-primary/10" : "bg-transparent"
                )}>
                  <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn(
                  "transition-all",
                  isActive ? "font-bold" : "font-medium"
                )}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
