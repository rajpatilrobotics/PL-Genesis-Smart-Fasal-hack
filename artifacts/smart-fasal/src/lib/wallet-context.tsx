import { createContext, useContext, useState, useEffect, useRef } from "react";
import { fcl } from "@/lib/flow";
import { useConnectWallet } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type FCLUser = { addr?: string; loggedIn?: boolean };

export type AccessLevel = "Private" | "Expert" | "Public";
export type RiskStatus = "Low" | "Medium" | "High";

export type DataEntry = {
  cid: string;
  timestamp: string;
  reward: number;
  accessLevel: AccessLevel;
  riskStatus: RiskStatus;
  aiHealth?: number;
  aiYield?: number;
  insights?: string;
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
  moisture?: number;
  temperature?: number;
};

type WalletContextType = {
  walletAddress: string | null;
  isManual: boolean;
  isConnecting: boolean;
  showManualInput: boolean;
  manualAddress: string;
  flowRewards: number;
  contributionCount: number;
  dataHistory: DataEntry[];
  certificates: string[];
  currentRisk: RiskStatus;
  handleConnect: () => Promise<void>;
  handleDisconnect: () => void;
  handleManualConnect: () => void;
  addFlowReward: (activity: string, points: number) => void;
  addDataEntry: (entry: DataEntry) => void;
  setCurrentRisk: (risk: RiskStatus) => void;
  setManualAddress: (addr: string) => void;
  setShowManualInput: (show: boolean) => void;
};

const WalletContext = createContext<WalletContextType | null>(null);

const INITIAL_REWARDS = 100;

function computeCertificates(count: number): string[] {
  const certs: string[] = [];
  if (count >= 1) certs.push("Early Adopter");
  if (count >= 3) certs.push("Sustainable Farmer");
  if (count >= 5) certs.push("Data Pioneer");
  if (count >= 10) certs.push("Climate Guardian");
  return certs;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [isManual, setIsManual] = useState(false);
  const [flowRewards, setFlowRewards] = useState(INITIAL_REWARDS);
  const [contributionCount, setContributionCount] = useState(0);
  const [dataHistory, setDataHistory] = useState<DataEntry[]>([]);
  const [currentRisk, setCurrentRisk] = useState<RiskStatus>("Medium");

  const isManualRef = useRef(false);
  isManualRef.current = isManual;

  const certificates = computeCertificates(contributionCount);

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
    setContributionCount(0);
    setDataHistory([]);
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

  const addDataEntry = (entry: DataEntry) => {
    setDataHistory((prev) => [entry, ...prev]);
    setContributionCount((prev) => prev + 1);
    setCurrentRisk(entry.riskStatus);
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
        contributionCount,
        dataHistory,
        certificates,
        currentRisk,
        handleConnect,
        handleDisconnect,
        handleManualConnect,
        addFlowReward,
        addDataEntry,
        setCurrentRisk,
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
