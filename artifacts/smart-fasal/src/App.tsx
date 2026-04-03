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
import NotFound from "@/pages/not-found";
import { WalletProvider } from "@/lib/wallet-context";

const queryClient = new QueryClient();

function Router() {
  return (
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <WalletProvider>
            <div className="pb-20 min-h-screen bg-muted/30">
              <TopHeader />
              <main className="container mx-auto px-4 py-6 max-w-md">
                <Router />
              </main>
              <BottomNav />
            </div>
          </WalletProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
