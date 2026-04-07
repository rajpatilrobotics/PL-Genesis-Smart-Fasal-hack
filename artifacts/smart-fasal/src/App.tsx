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

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-20 min-h-screen dot-grid-bg" style={{
      background: "linear-gradient(160deg, hsl(145, 40%, 97%) 0%, hsl(120, 30%, 98%) 40%, hsl(200, 35%, 97%) 100%)"
    }}>
      <TopHeader />
      <main className="container mx-auto px-4 py-5 max-w-md">
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
