import { useState, useEffect } from "react";
import { Leaf, Wallet, Gift, LogOut } from "lucide-react";
import { useConnectWallet, useGetRewards, getGetRewardsQueryKey, useAddRewardPoints } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { fcl } from "@/lib/flow";

export default function TopHeader() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

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
        connectWallet.mutate({ data: { walletAddress: user.addr } }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
          }
        });
      } else {
        setWalletAddress(null);
      }
    });
    return () => unsub();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await fcl.authenticate();
    } catch {
      toast({
        title: "Connection Failed",
        description: "Could not connect to Flow Wallet.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await fcl.unauthenticate();
    setWalletAddress(null);
    toast({ title: "Wallet Disconnected" });
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
                <Wallet className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">{displayAddress}</span>
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

          {!walletAddress && (
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
        </div>
      </div>
    </header>
  );
}
