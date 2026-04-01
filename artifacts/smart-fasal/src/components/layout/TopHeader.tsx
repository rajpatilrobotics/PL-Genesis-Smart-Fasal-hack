import { useState, useEffect } from "react";
import { Leaf, Wallet, Gift, LogOut, CheckCircle } from "lucide-react";
import { useConnectWallet, useGetRewards, getGetRewardsQueryKey, useAddRewardPoints } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { fcl } from "@/lib/flow";

export default function TopHeader() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [isManual, setIsManual] = useState(false);

  const connectWallet = useConnectWallet();
  const addReward = useAddRewardPoints();
  const { data: rewards } = useGetRewards({
    query: {
      queryKey: getGetRewardsQueryKey(),
    }
  });

  useEffect(() => {
    const unsub = fcl.currentUser.subscribe((user: { addr?: string; loggedIn?: boolean }) => {
      if (user.loggedIn && user.addr) {
        setWalletAddress(user.addr);
        setIsManual(false);
        connectWallet.mutate({ data: { walletAddress: user.addr } }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
          }
        });
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
    } catch {
      toast({
        title: "Wallet Connection Failed",
        description: "Could not connect automatically. You can enter your address manually below.",
        variant: "destructive",
      });
      setShowManualInput(true);
    } finally {
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
    connectWallet.mutate({ data: { walletAddress: trimmed } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
        toast({ title: "Wallet Connected", description: "Manual address accepted." });
      }
    });
  };

  const handleDailyCheckIn = () => {
    if (!walletAddress) return;
    addReward.mutate({
      data: {
        activity: "Daily Check-in",
        points: 10,
        walletAddress,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Check-in Successful", description: "You earned 10 points!" });
        queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
      }
    });
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
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                )}
                <span className="text-xs font-semibold text-primary">{displayAddress}</span>
                <span className="text-[10px] text-green-600 font-medium">Connected</span>
                {rewards?.totalPoints != null && (
                  <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                    {rewards.totalPoints} pts
                  </span>
                )}
                <button
                  onClick={handleDisconnect}
                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Disconnect"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            </>
          )}

          {!walletAddress && !showManualInput && (
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              size="sm"
              className="rounded-full font-semibold px-4"
            >
              <Wallet className="w-4 h-4 mr-2" />
              {isConnecting ? "Connecting..." : "Connect Flow"}
            </Button>
          )}

          {!walletAddress && showManualInput && (
            <div className="flex items-center gap-2">
              <Input
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="0x... wallet address"
                className="h-8 text-xs w-44"
                onKeyDown={(e) => e.key === "Enter" && handleManualConnect()}
              />
              <Button size="sm" className="h-8 text-xs px-3" onClick={handleManualConnect}>
                Connect
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs px-2"
                onClick={() => setShowManualInput(false)}
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
