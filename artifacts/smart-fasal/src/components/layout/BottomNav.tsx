import { Link, useLocation } from "wouter";
import { Home, BarChart2, Brain, Shield, ShoppingCart, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const [location] = useLocation();

  const links = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/analytics", icon: BarChart2, label: "Analytics" },
    { href: "/ai", icon: Brain, label: "AI Hub" },
    { href: "/insurance", icon: Shield, label: "Insurance" },
    { href: "/market", icon: ShoppingCart, label: "Market" },
    { href: "/community", icon: Users, label: "Community" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border">
      <div className="container mx-auto px-2 max-w-md">
        <nav className="flex items-center justify-between h-16">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;
            
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 text-xs font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                data-testid={`nav-${link.label.toLowerCase()}`}
              >
                <div className={cn(
                  "p-1.5 rounded-full transition-all duration-300",
                  isActive ? "bg-primary/10" : "bg-transparent"
                )}>
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn(
                  "scale-90 transition-transform",
                  isActive ? "scale-100 font-bold" : "font-medium"
                )}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
