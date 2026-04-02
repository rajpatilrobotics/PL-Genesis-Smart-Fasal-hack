import { Leaf, Wallet, LogOut, Wifi, CheckCircle, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet-context";

const MOCK_BALANCE = "100,000";

export default function TopHeader() {
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
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 flex items-center justify-between gap-3 py-2.5">

        {/* Logo */}
        <div className="flex flex-col shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <Leaf className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight">Smart Fasal</span>
          </div>
          <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-px leading-tight">
            ⛓ Powered by Flow Blockchain
          </span>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2 min-w-0">

          {/* CONNECTED STATE */}
          {walletAddress && (
            <div className="flex flex-col items-end gap-1 min-w-0">

              {/* Address pill */}
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 text-xs">
                {isManual
                  ? <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                  : <Wifi className="w-3 h-3 text-green-500 shrink-0" />
                }
                <span className="font-mono font-semibold text-primary truncate max-w-[110px]">{displayAddress}</span>
                <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-px rounded-full shrink-0">LIVE</span>
                <button onClick={handleDisconnect} className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0" title="Disconnect">
                  <LogOut className="w-3 h-3" />
                </button>
              </div>

              {/* Wallet info row */}
              <div className="flex items-center gap-2 text-[10px] px-1 flex-wrap justify-end">
                <span className="text-muted-foreground">
                  Network: <span className="font-semibold text-foreground">Flow Testnet</span>
                </span>
                <span className="text-border">·</span>
                <span className="text-muted-foreground">
                  Balance: <span className="font-semibold text-foreground">{MOCK_BALANCE} FLOW</span>
                </span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                  <Gift className="w-3 h-3" />
                  {flowRewards} FLOW
                </span>
              </div>

              {/* Rewards label */}
              <span className="text-[8px] text-muted-foreground/70 px-1">
                Rewards powered by Flow Blockchain
              </span>
            </div>
          )}

          {/* NOT CONNECTED — Manual input */}
          {!walletAddress && showManualInput && (
            <div className="flex items-center gap-1.5">
              <Input
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="0x... Flow address"
                className="h-8 text-xs w-36"
                onKeyDown={(e) => e.key === "Enter" && handleManualConnect()}
                autoFocus
              />
              <Button size="sm" className="h-8 text-xs px-2.5" onClick={() => handleManualConnect()}>Go</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs px-2"
                onClick={() => { setShowManualInput(false); setManualAddress(""); }}>✕</Button>
            </div>
          )}

          {/* NOT CONNECTED — Connect button */}
          {!walletAddress && !showManualInput && (
            <div className="flex items-center gap-2">
              <Button onClick={handleConnect} disabled={isConnecting} size="sm" className="rounded-full font-semibold px-4">
                <Wallet className="w-4 h-4 mr-1.5" />
                {isConnecting ? "Connecting..." : "Connect Flow"}
              </Button>
              <button onClick={() => setShowManualInput(true)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors">
                Manual
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
