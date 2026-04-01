import { createContext, useContext, useState, useEffect, useRef } from "react";
import { fcl } from "@/lib/flow";
import {
  useAddRewardPoints,
  useConnectWallet,
  useGetRewards,
  getGetRewardsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type FCLUser = { addr?: string; loggedIn?: boolean };

type Rewards = { totalPoints: number; walletAddress: string } | undefined;

type WalletContextType = {
  walletAddress: string | null;
  isManual: boolean;
  isConnecting: boolean;
  showManualInput: boolean;
  manualAddress: string;
  rewards: Rewards;
  handleConnect: () => Promise<void>;
  handleDisconnect: () => Promise<void>;
  handleManualConnect: () => void;
  addFlowReward: (activity: string, points: number) => void;
  setManualAddress: (addr: string) => void;
  setShowManualInput: (show: boolean) => void;
};

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [isManual, setIsManual] = useState(false);

  const isManualRef = useRef(false);
  isManualRef.current = isManual;

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
      } else if (!isManualRef.current) {
        setWalletAddress(null);
      }
    });
    return () => unsub();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await fcl.authenticate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("Declined") && !message.includes("Halted")) {
        toast({
          title: "Connection Failed",
          description: "Could not connect. Try entering your address manually.",
          variant: "destructive",
        });
        setShowManualInput(true);
      }
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!isManual) await fcl.unauthenticate();
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

  const addFlowReward = (activity: string, points: number) => {
    if (!walletAddress) return;
    addReward.mutate(
      { data: { activity, points, walletAddress } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() });
          toast({
            title: `+${points} FLOW Earned`,
            description: activity,
          });
        },
      }
    );
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isManual,
        isConnecting,
        showManualInput,
        manualAddress,
        rewards,
        handleConnect,
        handleDisconnect,
        handleManualConnect,
        addFlowReward,
        setManualAddress,
        setShowManualInput,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
