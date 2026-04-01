import { useState } from "react";
import { Leaf, Wallet, Gift } from "lucide-react";
import { useConnectWallet, useGetRewards, getGetRewardsQueryKey, useAddRewardPoints } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function TopHeader() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [walletInput, setWalletInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const connectWallet = useConnectWallet();
  const addReward = useAddRewardPoints();
  const { data: rewards } = useGetRewards({
    query: {
      queryKey: getGetRewardsQueryKey(),
      // In a real app we might pass the connected wallet address here
    }
  });

  const handleConnect = () => {
    if (!walletInput) return;
    
    connectWallet.mutate({ data: { walletAddress: walletInput } }, {
      onSuccess: () => {
        toast({
          title: "Wallet Connected",
          description: `Successfully connected Flow wallet ${walletInput.substring(0, 6)}...`,
        });
        setIsOpen(false);
        queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
      },
      onError: () => {
        toast({
          title: "Connection Failed",
          description: "Failed to connect wallet.",
          variant: "destructive"
        });
      }
    });
  };

  const handleDailyCheckIn = () => {
    addReward.mutate({
      data: {
        activity: "Daily Check-in",
        points: 10,
        walletAddress: rewards?.walletAddress
      }
    }, {
      onSuccess: () => {
        toast({ title: "Check-in Successful", description: "You earned 10 points!" });
        queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
      }
    });
  };

  const isConnected = rewards?.walletAddress;

  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Leaf className="w-7 h-7" />
          <h1 className="font-bold text-xl tracking-tight">Smart Fasal</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {isConnected && (
            <Button variant="ghost" size="icon" onClick={handleDailyCheckIn} disabled={addReward.isPending} data-testid="button-daily-checkin">
              <Gift className="w-5 h-5 text-accent" />
            </Button>
          )}
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant={isConnected ? "outline" : "default"} size="sm" className="rounded-full font-semibold px-4" data-testid="button-connect-wallet">
                <Wallet className="w-4 h-4 mr-2" />
                {isConnected ? (
                  <span className="flex items-center gap-1.5">
                    {rewards.walletAddress?.substring(0, 6)}...
                    <span className="bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full text-[10px]">
                      {rewards.totalPoints} pts
                    </span>
                  </span>
                ) : (
                  "Connect Flow"
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Flow Wallet</DialogTitle>
                <DialogDescription>
                  Enter your Flow wallet address to earn Web3 rewards for sustainable farming practices.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="0x..." 
                    value={walletInput} 
                    onChange={(e) => setWalletInput(e.target.value)} 
                    data-testid="input-wallet-address"
                  />
                </div>
                <Button 
                  onClick={handleConnect} 
                  className="w-full" 
                  disabled={connectWallet.isPending || !walletInput}
                  data-testid="button-submit-wallet"
                >
                  {connectWallet.isPending ? "Connecting..." : "Connect Wallet"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
