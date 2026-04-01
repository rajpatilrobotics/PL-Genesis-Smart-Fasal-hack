import { Leaf, Wallet, Gift, LogOut, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet-context";

export default function TopHeader() {
  const {
    walletAddress,
    isManual,
    isConnecting,
    showManualInput,
    manualAddress,
    rewards,
    handleConnect,
    handleDisconnect,
    handleManualConnect,
    setManualAddress,
    setShowManualInput,
  } = useWallet();

  const displayAddress = walletAddress
    ? `${walletAddress.substring(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  const flowBalance = "100,000";
  const flowRewards = rewards?.totalPoints ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 flex items-center justify-between gap-2 h-16">
        {/* Logo + badge */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 text-primary">
            <Leaf className="w-6 h-6 shrink-0" />
            <span className="font-bold text-lg tracking-tight truncate">Smart Fasal</span>
          </div>
          <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-px leading-tight w-fit">
            ⛓ Powered by Flow Blockchain
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {walletAddress ? (
            <div className="flex flex-col items-end gap-1">
              {/* Address row */}
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5">
                {isManual ? (
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Wifi className="w-3.5 h-3.5 text-green-500" />
                )}
                <span className="text-xs font-semibold text-primary">{displayAddress}</span>
                <span className="text-[10px] text-green-600 font-medium">Connected</span>
                <button
                  onClick={handleDisconnect}
                  className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>

              {/* Wallet info row */}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                <span className="font-medium text-foreground/70">Flow Testnet</span>
                <span className="text-border">·</span>
                <span>
                  <span className="font-semibold text-foreground">{flowBalance}</span>
                  <span className="ml-0.5 text-[9px]">FLOW</span>
                </span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-0.5">
                  <Gift className="w-2.5 h-2.5 text-amber-500" />
                  <span className="font-semibold text-amber-600">{flowRewards}</span>
                  <span className="text-[9px] text-amber-500">FLOW</span>
                </span>
              </div>
            </div>
          ) : showManualInput ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="0x... Flow address"
                className="h-8 text-xs w-36"
                onKeyDown={(e) => e.key === "Enter" && handleManualConnect()}
                autoFocus
              />
              <Button size="sm" className="h-8 text-xs px-2.5" onClick={handleManualConnect}>
                Go
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs px-2"
                onClick={() => { setShowManualInput(false); setManualAddress(""); }}
              >
                ✕
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                size="sm"
                className="rounded-full font-semibold px-4"
              >
                <Wallet className="w-4 h-4 mr-1.5" />
                {isConnecting ? "Connecting..." : "Connect Flow"}
              </Button>
              <button
                onClick={() => setShowManualInput(true)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Manual
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
