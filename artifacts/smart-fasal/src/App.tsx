import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/layout/BottomNav";
import TopHeader from "@/components/layout/TopHeader";
import Home from "@/pages/home";
import Analytics from "@/pages/analytics";
import AiHub from "@/pages/ai-hub";
import Insurance from "@/pages/insurance";
import Market from "@/pages/market";
import Community from "@/pages/community";
import Profile from "@/pages/profile";
import Web3Hub from "@/pages/web3-hub";
import Credit from "@/pages/credit";
import FinanceTrade from "@/pages/finance-trade";
import Onboarding from "@/pages/onboarding";
import NotFound from "@/pages/not-found";
import { WalletProvider } from "@/lib/wallet-context";
import { useEffect } from "react";
import { wakeUpServer } from "@/lib/api";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-20 min-h-screen dot-grid-bg" style={{
      background: "linear-gradient(165deg, #f0f9ff 0%, #ecfdf5 25%, #fefce8 55%, #fef9c3 80%, #f0fdf4 100%)"
    }}>
      {/* Ambient blobs — visible through glass cards on every page */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-0">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute top-2/3 right-0 w-64 h-64 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 w-48 h-48 rounded-full bg-lime-200/30 blur-2xl" />
      </div>
      <TopHeader />
      <main className="container mx-auto px-4 py-5 max-w-md relative z-10">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

function Router() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/ai" component={AiHub} />
        <Route path="/insurance" component={Insurance} />
        <Route path="/market" component={Market} />
        <Route path="/community" component={Community} />
        <Route path="/profile" component={Profile} />
        <Route path="/web3" component={Web3Hub} />
        <Route path="/credit" component={Credit} />
        <Route path="/finance" component={FinanceTrade} />
        <Route path="/onboarding" component={Onboarding} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  useEffect(() => {
    // Wake up the backend immediately on app load, then keep it alive every 4 minutes
    wakeUpServer();
    const interval = setInterval(wakeUpServer, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WalletProvider>
            <Router />
          </WalletProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
