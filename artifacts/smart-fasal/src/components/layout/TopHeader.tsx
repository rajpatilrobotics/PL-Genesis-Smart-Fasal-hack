import { Leaf, Wallet, LogOut, Wifi, CheckCircle, Gift, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const MOCK_BALANCE = "100,000";

const DEMO_ADDRESSES = [
  "0xf8d6e0586b0a20c7",
  "0x1cf0e2f2f715450e",
  "0x9a0766d93b6608b7",
];

export default function TopHeader() {
  const {
    walletAddress,
    isManual,
    isConnecting,
    flowRewards,
    handleConnect,
    handleDisconnect,
    handleManualConnect,
  } = useWallet();

  const [showDialog, setShowDialog] = useState(false);
  const [localAddress, setLocalAddress] = useState("");

  const displayAddress = walletAddress
    ? `${walletAddress.substring(0, 8)}...${walletAddress.slice(-4)}`
    : null;

  const onOpenConnect = () => {
    setLocalAddress("");
    setShowDialog(true);
  };

  const onManualSubmit = () => {
    const trimmed = localAddress.trim();
    if (!trimmed) return;
    setShowDialog(false);
    handleManualConnect(trimmed);
  };

  const onDemoConnect = (addr: string) => {
    setShowDialog(false);
    handleManualConnect(addr);
  };

  const onTryFCL = async () => {
    setShowDialog(false);
    await handleConnect();
  };

  return (
    <>
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
                <span className="text-[8px] text-muted-foreground/70 px-1">
                  Rewards powered by Flow Blockchain
                </span>
              </div>
            )}

            {/* NOT CONNECTED — Connect button */}
            {!walletAddress && (
              <Button onClick={onOpenConnect} disabled={isConnecting} size="sm" className="rounded-full font-semibold px-4">
                <Wallet className="w-4 h-4 mr-1.5" />
                {isConnecting ? "Connecting..." : "Connect Flow"}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Connect Wallet Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Connect Flow Wallet
            </DialogTitle>
            <DialogDescription>
              Connect your Flow blockchain wallet to earn rewards and access Web3 features.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Demo addresses */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">DEMO ACCOUNTS (try instantly)</p>
              <div className="space-y-2">
                {DEMO_ADDRESSES.map((addr, i) => (
                  <button
                    key={addr}
                    onClick={() => onDemoConnect(addr)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        F{i + 1}
                      </div>
                      <div>
                        <p className="text-xs font-mono font-semibold">{addr}</p>
                        <p className="text-[10px] text-muted-foreground">Flow Testnet · 100,000 FLOW</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[9px] shrink-0">Connect</Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Manual entry */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">ENTER YOUR ADDRESS</p>
              <div className="flex gap-2">
                <Input
                  value={localAddress}
                  onChange={(e) => setLocalAddress(e.target.value)}
                  placeholder="0x... Flow address"
                  className="h-9 text-xs font-mono"
                  onKeyDown={(e) => e.key === "Enter" && onManualSubmit()}
                  autoFocus
                />
                <Button size="sm" className="h-9 px-3 shrink-0" onClick={onManualSubmit} disabled={!localAddress.trim()}>
                  Connect
                </Button>
              </div>
            </div>

            {/* FCL option */}
            <button
              onClick={onTryFCL}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <ExternalLink className="w-3 h-3" />
              Open Flow wallet app (requires browser extension)
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
