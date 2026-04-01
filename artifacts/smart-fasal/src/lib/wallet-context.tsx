import { createContext, useContext, useState, useEffect, useRef } from "react";
import { fcl } from "@/lib/flow";
import { useConnectWallet } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type FCLUser = { addr?: string; loggedIn?: boolean };

type WalletContextType = {
  walletAddress: string | null;
  isManual: boolean;
  isConnecting: boolean;
  showManualInput: boolean;
  manualAddress: string;
  flowRewards: number;
  handleConnect: () => Promise<void>;
  handleDisconnect: () => void;
  handleManualConnect: () => void;
  addFlowReward: (activity: string, points: number) => void;
  setManualAddress: (addr: string) => void;
  setShowManualInput: (show: boolean) => void;
};

const WalletContext = createContext<WalletContextType | null>(null);

const INITIAL_REWARDS = 100;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [isManual, setIsManual] = useState(false);
  const [flowRewards, setFlowRewards] = useState(INITIAL_REWARDS);

  const isManualRef = useRef(false);
  isManualRef.current = isManual;

  const connectWalletMutation = useConnectWallet();

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
              toast({
                title: "Wallet Connected",
                description: `Flow Testnet — ${user.addr!.substring(0, 8)}...`,
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

  const handleDisconnect = () => {
    if (!isManual) fcl.unauthenticate();
    setWalletAddress(null);
    setIsManual(false);
    setShowManualInput(false);
    setManualAddress("");
    setFlowRewards(INITIAL_REWARDS);
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
          toast({ title: "Wallet Connected", description: "Flow Testnet — manual address." });
        },
      }
    );
  };

  const addFlowReward = (activity: string, points: number) => {
    if (!walletAddress) return;
    setFlowRewards((prev) => prev + points);
    toast({
      title: `+${points} FLOW Earned`,
      description: activity,
    });
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isManual,
        isConnecting,
        showManualInput,
        manualAddress,
        flowRewards,
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
