import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from "@clerk/react";
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
import { useUserProfile } from "@/lib/useUserProfile";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function AuthBackground() {
  return (
    <>
      {/* Gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-600 via-green-700 to-teal-800" />
      {/* Decorative blobs */}
      <div className="fixed top-0 left-0 w-64 h-64 rounded-full bg-white/5 blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-80 h-80 rounded-full bg-teal-400/10 blur-3xl translate-x-1/3 translate-y-1/3" />
      <div className="fixed top-1/2 left-1/4 w-48 h-48 rounded-full bg-emerald-300/10 blur-2xl" />
      {/* Dot grid overlay */}
      <div className="fixed inset-0 opacity-20" style={{
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)",
        backgroundSize: "28px 28px"
      }} />
      {/* Top branding strip */}
      <div className="fixed top-6 left-0 right-0 flex flex-col items-center z-10">
        <div className="flex items-center gap-2 mb-1">
          <img src="/logo.jpeg" alt="Smart Fasal" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/30 shadow-lg" />
          <span className="text-2xl font-extrabold text-white tracking-tight drop-shadow">Smart Fasal</span>
        </div>
        <p className="text-emerald-100/70 text-xs font-medium">🌾 AI · IoT · Web3 Agriculture Platform</p>
      </div>
    </>
  );
}

function SignInPage() {
  return (
    <div className="relative flex items-center justify-center min-h-screen px-4">
      <AuthBackground />
      <div className="relative z-10 mt-16">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="relative flex items-center justify-center min-h-screen px-4">
      <AuthBackground />
      <div className="relative z-10 mt-16">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useUser();
  const [location, setLocation] = useLocation();
  const { data, isLoading } = useUserProfile();

  useEffect(() => {
    if (!isSignedIn || isLoading || location === "/onboarding") return;
    if (data && !data.profile?.profileComplete) {
      setLocation("/onboarding");
    }
  }, [isSignedIn, isLoading, data, location, setLocation]);

  return <>{children}</>;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <Component />;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

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
    <ProfileGuard>
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/onboarding" component={Onboarding} />
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <WalletProvider>
            <Router />
          </WalletProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
