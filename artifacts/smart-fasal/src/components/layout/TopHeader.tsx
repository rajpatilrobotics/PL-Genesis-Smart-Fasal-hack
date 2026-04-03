import { Wallet, LogOut, Wifi, CheckCircle, Gift, UserCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet-context";
import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const MOCK_BALANCE = "100,000";
const clerkEnabled = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ClerkAuthButtonInner() {
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  if (isSignedIn) {
    const name = user.firstName || user.emailAddresses[0]?.emailAddress?.split("@")[0] || "Farmer";
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setLocation("/profile")}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/8 border border-primary/15 rounded-full px-2.5 py-1"
          title={t("header.myProfile")}
        >
          {user.imageUrl
            ? <img src={user.imageUrl} alt={name} className="w-5 h-5 rounded-full object-cover ring-1 ring-primary/30" />
            : <UserCircle className="w-4 h-4" />}
          <span className="max-w-[70px] truncate hidden sm:inline">{name}</span>
        </button>
        <button
          onClick={() => signOut(() => setLocation("/"))}
          className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-full hover:bg-destructive/8"
          title={t("header.signOut")}
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs px-2.5 gap-1 rounded-full border-primary/25 text-primary hover:bg-primary/8 hover:border-primary/40 font-semibold"
      onClick={() => setLocation("/sign-in")}
    >
      <LogIn className="w-3 h-3 shrink-0" />
      <span>{t("header.signIn")}</span>
    </Button>
  );
}

function ClerkAuthButton() {
  if (!clerkEnabled) return null;
  return <ClerkAuthButtonInner />;
}

export default function TopHeader() {
  const { t } = useTranslation();
  const {
    walletAddress,
    isManual,
    isConnecting,
    showManualInput,
    manualAddress,
    flowRewards,
    handleConnect,
    handleDisconnect,
    handleManualConnect,
    setManualAddress,
    setShowManualInput,
  } = useWallet();

  const displayAddress = walletAddress
    ? `${walletAddress.substring(0, 8)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-white/85 dark:bg-background/85 backdrop-blur-xl shadow-sm">
      {/* Thin green accent line at very top */}
      <div className="h-[2.5px] w-full bg-gradient-to-r from-emerald-500 via-green-400 to-teal-500" />

      <div className="container mx-auto px-3 flex items-center justify-between gap-2 py-2">

        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <img
              src="/logo.jpeg"
              alt="Smart Fasal"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover shadow-md ring-2 ring-emerald-200/80"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-gradient-green leading-tight">Smart Fasal</span>
            <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-600 leading-tight">The Agriculture Platform</span>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="hidden sm:block"><LanguageSwitcher /></div>
          <ClerkAuthButton />

          {/* CONNECTED STATE */}
          {walletAddress && (
            <div className="flex flex-col items-end gap-1 min-w-0">

              {/* Address pill */}
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-full px-3 py-1 text-xs shadow-sm">
                {isManual
                  ? <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                  : <Wifi className="w-3 h-3 text-emerald-500 shrink-0" />
                }
                <span className="font-mono font-semibold text-emerald-800 truncate max-w-[110px]">{displayAddress}</span>
                <span className="text-[9px] bg-emerald-500 text-white font-bold px-1.5 py-px rounded-full shrink-0 animate-pulse">
                  {t("header.live")}
                </span>
                <button onClick={handleDisconnect} className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0" title={t("header.signOut")}>
                  <LogOut className="w-3 h-3" />
                </button>
              </div>

              {/* Wallet info row */}
              <div className="flex items-center gap-2 text-[10px] px-1 flex-wrap justify-end">
                <span className="text-muted-foreground">
                  {t("header.network")}: <span className="font-semibold text-foreground">Flow Testnet</span>
                </span>
                <span className="text-border">·</span>
                <span className="text-muted-foreground">
                  {t("header.balance")}: <span className="font-semibold text-foreground">{MOCK_BALANCE} FLOW</span>
                </span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                  <Gift className="w-3 h-3" />
                  {flowRewards} FLOW
                </span>
              </div>
            </div>
          )}

          {/* NOT CONNECTED — Address input form */}
          {!walletAddress && showManualInput && (
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <Input
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="0x... Flow wallet address"
                  className="h-8 text-xs w-40"
                  onKeyDown={(e) => e.key === "Enter" && handleManualConnect()}
                  autoFocus
                />
                <Button
                  size="sm"
                  className="h-8 text-xs px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-0"
                  onClick={() => handleManualConnect()}
                  disabled={!manualAddress.trim()}
                >
                  Connect
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full"
                  onClick={() => { setShowManualInput(false); setManualAddress(""); }}>✕</Button>
              </div>
              <button
                onClick={() => { setShowManualInput(false); handleConnect(); }}
                disabled={isConnecting}
                className="text-[10px] text-emerald-600 hover:text-emerald-800 underline underline-offset-2 text-left pl-1 transition-colors"
              >
                {isConnecting ? "Opening Flow wallet…" : "Use Flow Wallet app instead"}
              </button>
            </div>
          )}

          {/* NOT CONNECTED — Connect button */}
          {!walletAddress && !showManualInput && (
            <Button
              onClick={() => setShowManualInput(true)}
              size="sm"
              className="rounded-full font-bold px-3 h-8 text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all duration-200 border-0 text-white whitespace-nowrap"
            >
              <Wallet className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span className="hidden sm:inline">Connect Wallet</span>
              <span className="sm:hidden">Connect</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
