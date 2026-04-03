import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
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
import SignIn from "@/pages/sign-in";
import SignUp from "@/pages/sign-up";
import { WalletProvider } from "@/lib/wallet-context";
import { AuthProvider, useAuthContext } from "@/lib/auth-context";

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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuthContext();
  if (loading) return null;
  if (!user) return <Redirect to="/sign-in" />;
  return <Component />;
}

function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    if (location === "/onboarding") return;
    if (!user.profileComplete) {
      setLocation("/onboarding");
    }
  }, [loading, user, location, setLocation]);

  return <>{children}</>;
}

function Router() {
  const { user, loading } = useAuthContext();

  return (
    <ProfileGuard>
      <Switch>
        <Route path="/sign-in" component={SignIn} />
        <Route path="/sign-up" component={SignUp} />
        <Route path="/onboarding">
          {loading ? null : user ? <Onboarding /> : <Redirect to="/sign-in" />}
        </Route>
        <Route>
          <AppShell>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/analytics">
                <ProtectedRoute component={Analytics} />
              </Route>
              <Route path="/ai">
                <ProtectedRoute component={AiHub} />
              </Route>
              <Route path="/insurance">
                <ProtectedRoute component={Insurance} />
              </Route>
              <Route path="/market">
                <ProtectedRoute component={Market} />
              </Route>
              <Route path="/community">
                <ProtectedRoute component={Community} />
              </Route>
              <Route path="/profile">
                <ProtectedRoute component={Profile} />
              </Route>
              <Route path="/web3">
                <ProtectedRoute component={Web3Hub} />
              </Route>
              <Route path="/credit">
                <ProtectedRoute component={Credit} />
              </Route>
              <Route path="/finance">
                <ProtectedRoute component={FinanceTrade} />
              </Route>
              <Route component={NotFound} />
            </Switch>
          </AppShell>
        </Route>
      </Switch>
    </ProfileGuard>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WalletProvider>
              <Router />
            </WalletProvider>
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
