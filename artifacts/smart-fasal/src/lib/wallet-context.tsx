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
  zkProofId?: string;
};

export type NFT = {
  id: string;
  seasonName: string;
  crop: string;
  health: number;
  cid: string;
  mintedAt: string;
  flowId: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
};

export type CarbonCredit = {
  id: string;
  tonnes: number;
  activity: string;
  mintedAt: string;
  hypercertId: string;
  waterSaved: number;
  impactScore: number;
};

export type DataListing = {
  id: string;
  cid: string;
  title: string;
  priceFlow: number;
  sold: boolean;
  earnings: number;
  category: string;
  records: number;
};

export type ZKProof = {
  id: string;
  claim: string;
  proofHash: string;
  verified: boolean;
  generatedAt: string;
  starknetTx: string;
  sigR?: string;
  sigS?: string;
  publicKey?: string;
  blockNumber?: number;
  networkLive?: boolean;
  explorerUrl?: string;
};

export type InsuranceClaim = {
  id: string;
  policyId: string;
  claimType: "drought" | "flood" | "frost" | "pest";
  riskScore: number;
  sensorReading: string;
  flowTxId: string;
  status: "filed" | "approved" | "paid";
  payoutAmount: number;
  filedAt: string;
};

export type OracleReading = {
  id: string;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  moisture: number;
  flowTxId: string;
  anchoredAt: string;
};

export type ExpertPayment = {
  id: string;
  expertName: string;
  amount: number;
  flowTxId: string;
  question: string;
  paidAt: string;
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
  nfts: NFT[];
  carbonCredits: CarbonCredit[];
  dataListings: DataListing[];
  zkProofs: ZKProof[];
  insuranceClaims: InsuranceClaim[];
  oracleReadings: OracleReading[];
  expertPayments: ExpertPayment[];
  handleConnect: () => Promise<void>;
  handleDisconnect: () => void;
  handleManualConnect: (address?: string) => void;
  addFlowReward: (activity: string, points: number) => void;
  addDataEntry: (entry: DataEntry) => void;
  setCurrentRisk: (risk: RiskStatus) => void;
  setManualAddress: (addr: string) => void;
  setShowManualInput: (show: boolean) => void;
  mintNFT: (nft: NFT) => void;
  mintCarbonCredit: (credit: CarbonCredit) => void;
  publishDataListing: (listing: DataListing) => void;
  addZKProof: (proof: ZKProof) => void;
  addInsuranceClaim: (claim: InsuranceClaim) => void;
  addOracleReading: (reading: OracleReading) => void;
  addExpertPayment: (payment: ExpertPayment) => void;
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

function randomHex(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
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
  const [nfts, setNFTs] = useState<NFT[]>([]);
  const [carbonCredits, setCarbonCredits] = useState<CarbonCredit[]>([]);
  const [dataListings, setDataListings] = useState<DataListing[]>([]);
  const [zkProofs, setZKProofs] = useState<ZKProof[]>([]);
  const [insuranceClaims, setInsuranceClaims] = useState<InsuranceClaim[]>([]);
  const [oracleReadings, setOracleReadings] = useState<OracleReading[]>([]);
  const [expertPayments, setExpertPayments] = useState<ExpertPayment[]>([]);

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
        setIsConnecting(false);
      }
    });
    return () => unsub();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);

    const timeout = setTimeout(() => {
      try { fcl.unauthenticate(); } catch (_) { /* ignore */ }
      setIsConnecting(false);
      setShowManualInput(true);
      toast({
        title: "Wallet not detected",
        description: "Enter your Flow address manually below to connect.",
      });
    }, 8000);

    try {
      await fcl.authenticate();
      clearTimeout(timeout);
    } catch (err: unknown) {
      clearTimeout(timeout);
      try { fcl.unauthenticate(); } catch (_) { /* ignore */ }
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
    setNFTs([]);
    setCarbonCredits([]);
    setDataListings([]);
    setZKProofs([]);
    setInsuranceClaims([]);
    setOracleReadings([]);
    setExpertPayments([]);
    toast({ title: "Wallet Disconnected" });
  };

  const handleManualConnect = (address?: string) => {
    const trimmed = (address ?? manualAddress).trim();
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

  const mintNFT = (nft: NFT) => {
    setNFTs((prev) => [nft, ...prev]);
    addFlowReward("Season NFT Minted on Flow", 50);
  };

  const mintCarbonCredit = (credit: CarbonCredit) => {
    setCarbonCredits((prev) => [credit, ...prev]);
    addFlowReward("Hypercert Carbon Credit Minted", 30);
  };

  const publishDataListing = (listing: DataListing) => {
    setDataListings((prev) => [listing, ...prev]);
    addFlowReward("Farm Data Published on Filecoin", 15);
  };

  const addZKProof = (proof: ZKProof) => {
    setZKProofs((prev) => [proof, ...prev]);
  };

  const addInsuranceClaim = (claim: InsuranceClaim) => {
    setInsuranceClaims((prev) => [claim, ...prev]);
    addFlowReward("Parametric Insurance Claim Filed on Flow", 20);
  };

  const addOracleReading = (reading: OracleReading) => {
    setOracleReadings((prev) => [reading, ...prev]);
    addFlowReward("Farm Data Anchored on Flow Oracle", 8);
  };

  const addExpertPayment = (payment: ExpertPayment) => {
    setExpertPayments((prev) => [payment, ...prev]);
    setFlowRewards((prev) => Math.max(0, prev - payment.amount));
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
        nfts,
        carbonCredits,
        dataListings,
        zkProofs,
        insuranceClaims,
        oracleReadings,
        expertPayments,
        handleConnect,
        handleDisconnect,
        handleManualConnect,
        addFlowReward,
        addDataEntry,
        setCurrentRisk,
        setManualAddress,
        setShowManualInput,
        mintNFT,
        mintCarbonCredit,
        publishDataListing,
        addZKProof,
        addInsuranceClaim,
        addOracleReading,
        addExpertPayment,
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
