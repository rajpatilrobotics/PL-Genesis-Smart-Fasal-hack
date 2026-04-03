import { useState } from "react";
import { Wallet, LogOut, Wifi, CheckCircle, Gift, X, QrCode, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet-context";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const MOCK_BALANCE = "100,000";

export default function TopHeader() {
  const { t } = useTranslation();
  const {
    walletAddress,
    isManual,
    isConnecting,
    manualAddress,
    flowRewards,
    handleConnect,
    handleDisconnect,
    handleManualConnect,
    setManualAddress,
  } = useWallet();

  const [showDialog, setShowDialog] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const displayAddress = walletAddress
    ? `${walletAddress.substring(0, 8)}...${walletAddress.slice(-4)}`
    : null;

  const openDialog = () => {
    setShowManual(false);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setShowManual(false);
    setManualAddress("");
  };

  const onWalletConnect = async () => {
    setShowDialog(false);
    setShowManual(false);
    await handleConnect();
  };

  const onManualSubmit = () => {
    handleManualConnect();
    closeDialog();
  };

  return (
    <>
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

            {/* NOT CONNECTED — Connect button */}
            {!walletAddress && (
              <div className="flex flex-col items-end gap-0.5">
                <Button
                  onClick={openDialog}
                  disabled={isConnecting}
                  size="sm"
                  className="rounded-full font-bold px-3 h-8 text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all duration-200 border-0 text-white whitespace-nowrap"
                >
                  {isConnecting ? (
                    <>
                      <span className="w-3 h-3 mr-1.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block shrink-0" />
                      Connecting…
                    </>
                  ) : (
                    <>
                      <Wallet className="w-3.5 h-3.5 mr-1 shrink-0" />
                      <span className="hidden sm:inline">Connect Wallet</span>
                      <span className="sm:hidden">Connect</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Connect Wallet Dialog */}
      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDialog} />

          {/* Sheet */}
          <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-sm">Connect Wallet</p>
                  <p className="text-xs text-muted-foreground">Flow Testnet</p>
                </div>
              </div>
              <button onClick={closeDialog} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {!showManual ? (
              <div className="flex flex-col gap-3">
                {/* WalletConnect option */}
                <button
                  onClick={onWalletConnect}
                  className="flex items-center gap-3 w-full rounded-xl border border-border p-3.5 text-left hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">WalletConnect</p>
                    <p className="text-xs text-muted-foreground">Scan QR with Flow wallet app</p>
                  </div>
                  <span className="text-muted-foreground group-hover:text-emerald-600 transition-colors text-lg">›</span>
                </button>

                {/* Manual address option */}
                <button
                  onClick={() => setShowManual(true)}
                  className="flex items-center gap-3 w-full rounded-xl border border-border p-3.5 text-left hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Keyboard className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Enter Address Manually</p>
                    <p className="text-xs text-muted-foreground">Paste your 0x… Flow address</p>
                  </div>
                  <span className="text-muted-foreground group-hover:text-emerald-600 transition-colors text-lg">›</span>
                </button>

                <p className="text-center text-[11px] text-muted-foreground pt-1">
                  No wallet yet?{" "}
                  <a href="https://flow.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline underline-offset-2">
                    Get Flow wallet
                  </a>
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button onClick={() => setShowManual(false)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
                  ‹ Back
                </button>
                <p className="text-sm font-medium">Enter your Flow address</p>
                <Input
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="0x1234abcd…"
                  className="h-10 font-mono text-sm"
                  onKeyDown={(e) => e.key === "Enter" && manualAddress.trim() && onManualSubmit()}
                  autoFocus
                />
                <Button
                  onClick={onManualSubmit}
                  disabled={!manualAddress.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-10"
                >
                  Connect
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
