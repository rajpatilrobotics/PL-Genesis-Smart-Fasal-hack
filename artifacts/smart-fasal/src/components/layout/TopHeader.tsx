import { useState, useEffect } from "react";
import { Leaf, Wallet, Gift, LogOut, CheckCircle, WifiIcon } from "lucide-react";
import { useConnectWallet, useGetRewards, getGetRewardsQueryKey, useAddRewardPoints } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { fcl } from "@/lib/flow";

type FCLUser = {
  addr?: string;
  loggedIn?: boolean;
};

export default function TopHeader() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [isManual, setIsManual] = useState(false);

  const connectWalletMutation = useConnectWallet();
  const addReward = useAddRewardPoints();
  const { data: rewards } = useGetRewards({
    query: { queryKey: getGetRewardsQueryKey() },
  });

  useEffect(() => {
    const unsub = fcl.currentUser.subscribe((user: FCLUser) => {
      if (user.loggedIn && user.addr) {
        setWalletAddress(user.addr);
        setIsManual(false);
        setIsConnecting(false);
        connectWalletMutation.mutate(
          { data: { walletAddress: user.addr } },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
              toast({
                title: "Connected to Flow Testnet",
                description: `${user.addr!.substring(0, 6)}...${user.addr!.slice(-4)}`,
              });
            },
          }
        );
      } else if (!isManual) {
        setWalletAddress(null);
      }
    });
    return () => unsub();
  }, [isManual]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await fcl.authenticate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("Declined") && !message.includes("Halted")) {
        toast({
          title: "Connection Failed",
          description: "Could not connect to Flow wallet. Try entering your address manually below.",
          variant: "destructive",
        });
        setShowManualInput(true);
      }
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!isManual) {
      await fcl.unauthenticate();
    }
    setWalletAddress(null);
    setIsManual(false);
    setShowManualInput(false);
    setManualAddress("");
    toast({ title: "Wallet Disconnected" });
  };

  const handleManualConnect = () => {
    const trimmed = manualAddress.trim();
    if (!trimmed) return;
    setWalletAddress(trimmed);
    setIsManual(true);
    setShowManualInput(false);
    connectWalletMutation.mutate(
      { data: { walletAddress: trimmed } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
          toast({ title: "Connected to Flow Testnet", description: "Manual address accepted." });
        },
      }
    );
  };

  const handleDailyCheckIn = () => {
    if (!walletAddress) return;
    addReward.mutate(
      { data: { activity: "Daily Check-in", points: 10, walletAddress } },
      {
        onSuccess: () => {
          toast({ title: "Check-in Successful", description: "You earned 10 points!" });
          queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
        },
      }
    );
  };

  const displayAddress = walletAddress
    ? `${walletAddress.substring(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Leaf className="w-7 h-7" />
          <h1 className="font-bold text-xl tracking-tight">Smart Fasal</h1>
        </div>

        <div className="flex items-center gap-2">
          {walletAddress && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDailyCheckIn}
                disabled={addReward.isPending}
                title="Daily Check-in (+10 pts)"
              >
                <Gift className="w-5 h-5 text-amber-500" />
              </Button>

              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5">
                {isManual ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <WifiIcon className="w-3.5 h-3.5 text-green-500" />
                )}
                <span className="text-xs font-semibold text-primary">{displayAddress}</span>
                <span className="text-[10px] text-green-600 font-medium">Testnet</span>
                {rewards?.totalPoints != null && (
                  <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                    {rewards.totalPoints} pts
                  </span>
                )}
                <button
                  onClick={handleDisconnect}
                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            </>
          )}

          {!walletAddress && !showManualInput && (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                size="sm"
                className="rounded-full font-semibold px-4"
              >
                <Wallet className="w-4 h-4 mr-2" />
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

          {!walletAddress && showManualInput && (
            <div className="flex items-center gap-2">
              <Input
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="0x... Flow address"
                className="h-8 text-xs w-44"
                onKeyDown={(e) => e.key === "Enter" && handleManualConnect()}
                autoFocus
              />
              <Button size="sm" className="h-8 text-xs px-3" onClick={handleManualConnect}>
                Connect
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs px-2"
                onClick={() => { setShowManualInput(false); setManualAddress(""); }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
