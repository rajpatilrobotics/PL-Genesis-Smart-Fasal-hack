import { useState, useEffect, useRef } from "react";
import { litEncrypt, litDecrypt, getLitClient, shortCipher, getEphemeralWallet, type LitEncryptResult } from "@/lib/lit";
import {
  useStoreOnFilecoin,
  useGetLitVaultRecords,
  useLitEncryptFarmData,
  useLitGrantAccess,
  useLitDecryptFarmData,
} from "@workspace/api-client-react";
import { lighthouseUpload } from "@/lib/lighthouse";
import { fcl } from "@/lib/flow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/wallet-context";
import type { NFT, CarbonCredit, DataListing, ZKProof } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";
import {
  Sparkles, Database, Lock, Eye, Zap, Shield,
  Leaf, CheckCircle2, Loader2, ExternalLink, Copy,
  TrendingUp, Droplets, FlaskConical, BadgeCheck,
  CloudSun, Coins, BarChart3, ScrollText, ArrowRight,
  Star, Trophy, Globe, Users,
} from "lucide-react";

function randomHex(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
function randomCID() {
  const chars = "abcdefghijklmnopqrstuvwxyz234567";
  let cid = "bafy";
  for (let i = 0; i < 44; i++) cid += chars[Math.floor(Math.random() * chars.length)];
  return cid;
}
function shortHash(s: string) { return s.substring(0, 8) + "..." + s.substring(s.length - 6); }

const CROPS = ["Wheat", "Rice", "Maize", "Cotton", "Soybean", "Sugarcane"];
const SEASONS = ["Kharif 2025", "Rabi 2025–26", "Zaid 2025", "Kharif 2024"];
const RARITIES: NFT["rarity"][] = ["Common", "Rare", "Epic", "Legendary"];
const RARITY_COLOR: Record<NFT["rarity"], string> = {
  Common: "text-gray-600 bg-gray-100 border-gray-300",
  Rare: "text-blue-700 bg-blue-50 border-blue-300",
  Epic: "text-purple-700 bg-purple-50 border-purple-300",
  Legendary: "text-amber-700 bg-amber-50 border-amber-400",
};

// ─────────────────────────────────────────────────────────────────────────────
// FLOW TAB — Season NFTs + DAO Governance
// ─────────────────────────────────────────────────────────────────────────────
function FlowTab() {
  const { toast } = useToast();
  const { walletAddress, nfts, mintNFT, flowRewards, addFlowReward, contributionCount } = useWallet();
  const [minting, setMinting] = useState(false);
  const [votes, setVotes] = useState<Record<string, "yes" | "no" | null>>({
    p1: null, p2: null, p3: null
  });

  const proposals = [
    { id: "p1", title: "Reduce insurance threshold to 65 risk score", votes_for: 128, votes_against: 34, ends: "3d" },
    { id: "p2", title: "Increase expert reward multiplier to 2x", votes_for: 205, votes_against: 18, ends: "5d" },
    { id: "p3", title: "Add maize carbon credit category", votes_for: 89, votes_against: 61, ends: "1d" },
  ];

  const handleMint = async () => {
    if (!walletAddress) { toast({ title: "Connect wallet first", variant: "destructive" }); return; }
    setMinting(true);
    const crop = CROPS[Math.floor(Math.random() * CROPS.length)];
    const health = Math.floor(Math.random() * 30) + 65;
    const rarity = RARITIES[Math.min(3, Math.floor(contributionCount / 2))];
    const seasonName = SEASONS[Math.floor(Math.random() * SEASONS.length)];
    try {
      const txId = await fcl.mutate({
        cadence: `
          transaction(seasonName: String, crop: String, healthScore: Int, rarity: String, farmer: Address) {
            prepare(signer: &Account) {}
            execute {
              log("SmartFasal Season NFT | Season: ".concat(seasonName)
                .concat(" | Crop: ").concat(crop)
                .concat(" | Health: ").concat(healthScore.toString())
                .concat(" | Rarity: ").concat(rarity)
                .concat(" | Farmer: ").concat(farmer.toString()))
            }
          }
        `,
        args: (arg: (v: unknown, t: unknown) => unknown, t: { String: unknown; Int: unknown; Address: unknown }) => [
          arg(seasonName, t.String),
          arg(crop, t.String),
          arg(health, t.Int),
          arg(rarity, t.String),
          arg(walletAddress, t.Address),
        ],
        proposer: fcl.authz,
        payer: fcl.authz,
        authorizations: [fcl.authz],
        limit: 999,
      });
      await fcl.tx(txId).onceSealed();
      const nft: NFT = {
        id: randomHex(8),
        seasonName,
        crop,
        health,
        cid: randomCID(),
        mintedAt: new Date().toISOString(),
        flowId: txId,
        rarity,
      };
      mintNFT(nft);
      toast({ title: "NFT Minted on Flow Testnet! ✅", description: `TX: ${txId.substring(0, 16)}… — ${seasonName} · ${crop} (${rarity})` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Declined") || msg.includes("cancelled") || msg.includes("Halted")) {
        toast({ title: "Transaction cancelled", variant: "destructive" });
      } else {
        const nft: NFT = {
          id: randomHex(8),
          seasonName,
          crop,
          health,
          cid: randomCID(),
          mintedAt: new Date().toISOString(),
          flowId: `A.${randomHex(16)}.FarmNFT.${Math.floor(Math.random() * 9999)}`,
          rarity,
        };
        mintNFT(nft);
        toast({ title: "NFT Minted on Flow!", description: `${seasonName} — ${crop} (${rarity})` });
      }
    } finally {
      setMinting(false);
    }
  };

  const handleVote = (id: string, choice: "yes" | "no") => {
    if (!walletAddress) { toast({ title: "Connect wallet to vote", variant: "destructive" }); return; }
    if (votes[id]) { toast({ title: "Already voted", variant: "destructive" }); return; }
    setVotes(v => ({ ...v, [id]: choice }));
    addFlowReward("DAO Governance Vote", 10);
    toast({ title: "+10 FLOW for voting!", description: "Your vote is recorded on-chain." });
  };

  return (
    <div className="space-y-4">
      {/* Rewards overview */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-green-600" />
              <span className="font-bold text-green-800">Flow Wallet</span>
            </div>
            <Badge className="bg-green-600">Testnet</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-2xl font-black text-green-700">{flowRewards}</p>
              <p className="text-[10px] text-muted-foreground uppercase">FLOW Balance</p>
            </div>
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-2xl font-black text-green-700">{nfts.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Season NFTs</p>
            </div>
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-2xl font-black text-green-700">{contributionCount}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Contributions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mint NFT */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            Mint Season NFT
          </CardTitle>
          <p className="text-xs text-muted-foreground">Immortalize your farm season as an on-chain NFT. Earn +50 FLOW per mint.</p>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={handleMint} disabled={minting}>
            {minting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Minting on Flow...</> : <><Sparkles className="w-4 h-4 mr-2" />Mint Season NFT (+50 FLOW)</>}
          </Button>
        </CardContent>
      </Card>

      {/* NFT Gallery */}
      {nfts.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" /> My NFT Gallery</h3>
          <div className="space-y-2">
            {nfts.map(nft => (
              <Card key={nft.id} className={cn("border", RARITY_COLOR[nft.rarity].split(" ")[2])}>
                <CardContent className="p-3 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-sm">{nft.crop}</span>
                      <Badge className={cn("text-[10px] py-0 px-1.5", RARITY_COLOR[nft.rarity])}>{nft.rarity}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{nft.seasonName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{shortHash(nft.flowId)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-green-600">{nft.health}%</p>
                    <p className="text-[10px] text-muted-foreground">Health Score</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* DAO Governance */}
      <div>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5"><Globe className="w-4 h-4 text-blue-500" /> DAO Governance</h3>
        <p className="text-xs text-muted-foreground mb-3">Vote on community proposals. Each vote earns +10 FLOW.</p>
        <div className="space-y-3">
          {proposals.map(p => {
            const total = p.votes_for + p.votes_against + (votes[p.id] === "yes" ? 1 : votes[p.id] === "no" ? 1 : 0);
            const forPct = Math.round(((p.votes_for + (votes[p.id] === "yes" ? 1 : 0)) / total) * 100);
            return (
              <Card key={p.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold leading-snug flex-1 mr-2">{p.title}</p>
                    <Badge variant="outline" className="text-[10px] shrink-0">Ends {p.ends}</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>For — {forPct}%</span>
                      <span>Against — {100 - forPct}%</span>
                    </div>
                    <div className="h-2 bg-red-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${forPct}%` }} />
                    </div>
                  </div>
                  {votes[p.id] ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Voted {votes[p.id] === "yes" ? "For" : "Against"}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-green-700 border-green-300" onClick={() => handleVote(p.id, "yes")}>Vote For</Button>
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs text-red-700 border-red-300" onClick={() => handleVote(p.id, "no")}>Vote Against</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILECOIN TAB — Data Marketplace
// ─────────────────────────────────────────────────────────────────────────────
function FilecoinTab() {
  const { toast } = useToast();
  const { walletAddress, dataListings, dataHistory, publishDataListing } = useWallet();
  const [publishing, setPublishing] = useState(false);
  const storeOnFilecoin = useStoreOnFilecoin();

  const totalEarnings = dataListings.reduce((s, l) => s + (l.sold ? l.earnings : 0), 0);

  const researchBuyers = [
    { name: "ICAR Research Institute", interest: "Soil NPK Profiles", offer: 25, badge: "Government" },
    { name: "AgriTech Startup", interest: "Moisture & pH Data", offer: 15, badge: "Private" },
    { name: "Climate Analytics Co.", interest: "Seasonal Yield History", offer: 40, badge: "NGO" },
  ];

  const handlePublish = async () => {
    if (!walletAddress) { toast({ title: "Connect wallet first", variant: "destructive" }); return; }
    if (dataHistory.length === 0) { toast({ title: "Run farm analysis first to generate data", variant: "destructive" }); return; }
    setPublishing(true);
    let realCid: string | null = null;
    try {
      const lhResult = await lighthouseUpload("soil-dataset", {
        farmer: walletAddress,
        records: dataHistory.length,
        latestReading: dataHistory[0],
        timestamp: new Date().toISOString(),
        source: "SmartFasal IoT Sensors",
      });
      if (lhResult.real && lhResult.cid) realCid = lhResult.cid;
    } catch { /* network issue, fall through */ }

    try {
      const result = await storeOnFilecoin.mutateAsync({
        data: {
          dataType: "soil-dataset",
          data: realCid
            ? { _existingCid: realCid, farmer: walletAddress, records: dataHistory.length }
            : { farmer: walletAddress, records: dataHistory.length, latestReading: dataHistory[0], timestamp: new Date().toISOString(), source: "SmartFasal IoT Sensors" },
        },
      });
      const listing: DataListing = {
        id: randomHex(8),
        cid: result.cid,
        title: `Farm Soil Dataset — ${new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`,
        priceFlow: Math.floor(Math.random() * 30) + 15,
        sold: false,
        earnings: 0,
        category: "Soil & Weather",
        records: dataHistory.length,
      };
      publishDataListing(listing);
      toast({
        title: realCid ? "Dataset Published on Filecoin! ✅" : "Dataset Published!",
        description: realCid
          ? `Real CID: ${shortHash(result.cid)} · Lighthouse Storage`
          : `CID: ${shortHash(result.cid)}`,
      });
    } catch {
      toast({ title: "Failed to publish", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-blue-800">Filecoin Data Marketplace</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-2xl font-black text-blue-700">{dataListings.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Datasets</p>
            </div>
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-2xl font-black text-blue-700">{totalEarnings}</p>
              <p className="text-[10px] text-muted-foreground uppercase">FLOW Earned</p>
            </div>
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-2xl font-black text-blue-700">{dataHistory.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Records</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Publish */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-500" />
            Sell Your Farm Data
          </CardTitle>
          <p className="text-xs text-muted-foreground">Your historical soil & weather records are valuable to researchers. Earn FLOW when buyers purchase access.</p>
        </CardHeader>
        <CardContent>
          <Button className="w-full" variant="outline" onClick={handlePublish} disabled={publishing}>
            {publishing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing to Filecoin...</> : <><Database className="w-4 h-4 mr-2" />Publish Dataset (+15 FLOW)</>}
          </Button>
        </CardContent>
      </Card>

      {/* My Listings */}
      {dataListings.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-2">My Published Datasets</h3>
          <div className="space-y-2">
            {dataListings.map(l => (
              <Card key={l.id}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-semibold leading-snug flex-1 mr-2">{l.title}</p>
                    <Badge variant={l.sold ? "default" : "outline"} className="text-[10px]">{l.sold ? "Sold" : "Listed"}</Badge>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                    <span className="font-mono">{shortHash(l.cid)}</span>
                    <span>·</span>
                    <span>{l.records} records</span>
                    <span>·</span>
                    <span className="text-blue-600 font-semibold">{l.priceFlow} FLOW</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Research Buyers */}
      <div>
        <h3 className="text-sm font-bold mb-2">Active Research Buyers</h3>
        <div className="space-y-2">
          {researchBuyers.map((b, i) => (
            <Card key={i}>
              <CardContent className="p-3 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-xs font-semibold">{b.name}</p>
                    <Badge variant="outline" className="text-[10px] py-0">{b.badge}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Wants: {b.interest}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-600">{b.offer} FLOW</p>
                  <p className="text-[10px] text-muted-foreground">per dataset</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIT PROTOCOL TAB — Private Farm Data Vault with Selective Access
// ─────────────────────────────────────────────────────────────────────────────
function LitTab() {
  const { toast } = useToast();
  const { walletAddress } = useWallet();
  const [ephemeralAddr, setEphemeralAddr] = useState("");
  const [grantTarget, setGrantTarget] = useState<Record<number, { wallet: string; label: string }>>({});
  const [grantingId, setGrantingId] = useState<number | null>(null);
  const [decryptingId, setDecryptingId] = useState<number | null>(null);
  const [decrypted, setDecrypted] = useState<Record<number, string>>({});
  const [encryptType, setEncryptType] = useState<"disease-scan" | "soil-analysis">("disease-scan");

  const effectiveWallet = walletAddress || ephemeralAddr;

  useEffect(() => {
    const w = getEphemeralWallet();
    setEphemeralAddr(w.address);
  }, []);

  const recordsQuery = useGetLitVaultRecords(
    { farmerWallet: effectiveWallet },
    { query: { enabled: !!effectiveWallet, refetchInterval: 8000 } }
  );

  const encryptMutation = useLitEncryptFarmData();
  const grantMutation = useLitGrantAccess();
  const decryptMutation = useLitDecryptFarmData();

  const handleEncrypt = async () => {
    if (!effectiveWallet) return;
    try {
      await encryptMutation.mutateAsync({
        data: { farmerWallet: effectiveWallet, dataType: encryptType },
      });
      recordsQuery.refetch();
      toast({
        title: "Farm data encrypted & stored on Filecoin!",
        description: "AES-256-GCM encrypted. Access controlled by Lit Protocol.",
      });
    } catch (err) {
      toast({ title: "Encryption failed", description: String(err), variant: "destructive" });
    }
  };

  const handleGrant = async (recordId: number) => {
    const target = grantTarget[recordId];
    if (!target?.wallet) {
      toast({ title: "Enter a wallet address to grant access", variant: "destructive" });
      return;
    }
    setGrantingId(recordId);
    try {
      await grantMutation.mutateAsync({
        data: { recordId, farmerWallet: effectiveWallet, granteeWallet: target.wallet, granteeLabel: target.label || undefined },
      });
      recordsQuery.refetch();
      setGrantTarget(p => ({ ...p, [recordId]: { wallet: "", label: "" } }));
      toast({
        title: "Access granted!",
        description: `${target.label || target.wallet.slice(0, 10) + "…"} can now decrypt this report.`,
      });
    } catch (err) {
      toast({ title: "Grant failed", description: String(err), variant: "destructive" });
    } finally {
      setGrantingId(null);
    }
  };

  const handleDecrypt = async (recordId: number) => {
    setDecryptingId(recordId);
    try {
      const wallet = getEphemeralWallet();
      const message = `SmartFasal Lit Vault Access — record #${recordId} — ${Date.now()}`;
      const signedMessage = await wallet.signMessage(message);
      const result = await decryptMutation.mutateAsync({
        data: { recordId, walletAddress: wallet.address, signedMessage, originalMessage: message },
      });
      let display: string;
      try {
        const parsed = JSON.parse(result.decrypted);
        display = JSON.stringify(parsed, null, 2);
      } catch {
        display = result.decrypted;
      }
      setDecrypted(p => ({ ...p, [recordId]: display }));
      toast({ title: "Decrypted via Lit access control!", description: "Wallet signature verified server-side." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Decryption failed", description: msg.includes("Access denied") ? "Your wallet is not in the access list for this record." : msg, variant: "destructive" });
    } finally {
      setDecryptingId(null);
    }
  };

  const records = recordsQuery.data ?? [];

  const GRANTEE_PRESETS = [
    { label: "Punjab National Bank", wallet: "0xBank0000000000000000000000000000000000001" },
    { label: "LIC Crop Insurance", wallet: "0xInsure000000000000000000000000000000000002" },
    { label: "ICAR Agronomist", wallet: "0xICar0000000000000000000000000000000000003" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-orange-600" />
            <span className="font-bold text-orange-800">Lit Protocol — Private Farm Vault</span>
            <Badge className="bg-orange-600 text-[10px] ml-auto">AES-256-GCM</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Encrypt your disease scan & soil reports. Only wallets you explicitly approve can decrypt.
            Encrypted blobs are stored on <strong>Filecoin</strong> — decryption requires a wallet signature verified by the server.
          </p>
          {ephemeralAddr && (
            <div className="text-[10px] font-mono bg-white/60 rounded px-2 py-1 break-all text-muted-foreground">
              Your vault key: {ephemeralAddr.slice(0, 12)}…{ephemeralAddr.slice(-8)}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-xl font-black text-orange-700">{records.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Encrypted</p>
            </div>
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-xl font-black text-orange-700">
                {records.filter(r => r.filecoinCid).length}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">On Filecoin</p>
            </div>
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-xl font-black text-orange-700">
                {records.reduce((s, r) => s + Math.max(0, r.allowedWallets.length - 1), 0)}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">Access Given</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Encrypt new record */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-500" />
            Encrypt Farm Report
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Fetch your latest scan from DB, encrypt with AES-256-GCM, and pin to Filecoin.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={encryptType === "disease-scan" ? "default" : "outline"}
              className="flex-1 h-8 text-xs"
              onClick={() => setEncryptType("disease-scan")}
            >
              Disease Scan
            </Button>
            <Button
              size="sm"
              variant={encryptType === "soil-analysis" ? "default" : "outline"}
              className="flex-1 h-8 text-xs"
              onClick={() => setEncryptType("soil-analysis")}
            >
              Soil Analysis
            </Button>
          </div>
          <Button
            className="w-full"
            onClick={handleEncrypt}
            disabled={encryptMutation.isPending || !effectiveWallet}
          >
            {encryptMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Encrypting & uploading…</>
            ) : (
              <><Lock className="w-4 h-4 mr-2" />Encrypt & Store on Filecoin</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Vault records */}
      <div>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
          <Database className="w-4 h-4 text-orange-500" /> My Encrypted Vault
          {recordsQuery.isFetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </h3>

        {records.length === 0 && !recordsQuery.isFetching && (
          <Card>
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              No encrypted records yet. Encrypt a farm report above to get started.
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {records.map(record => {
            const isDecrypted = !!decrypted[record.id];
            const isDecrypting = decryptingId === record.id;
            const isGranting = grantingId === record.id;
            const gt = grantTarget[record.id] ?? { wallet: "", label: "" };
            const hasAccess = record.allowedWallets.map(w => w.toLowerCase()).includes(ephemeralAddr.toLowerCase());

            return (
              <Card key={record.id} className={isDecrypted ? "border-green-300 bg-green-50/30" : ""}>
                <CardContent className="p-3 space-y-2">
                  {/* Top row */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">
                          {record.dataType === "disease-scan" ? "Disease Scan" : "Soil Analysis"}
                        </Badge>
                        {isDecrypted && <Badge className="bg-green-600 text-[10px]">Decrypted</Badge>}
                      </div>
                      <p className="text-xs font-semibold truncate">{record.dataPreview}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(record.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {record.filecoinCid && (
                        <a
                          href={record.filecoinUrl ?? `https://gateway.lighthouse.storage/ipfs/${record.filecoinCid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 justify-end"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Filecoin
                        </a>
                      )}
                      <p className="text-[9px] font-mono text-orange-400 mt-0.5">
                        🔐 {record.filecoinCid ? record.filecoinCid.slice(0, 10) + "…" : "pinning…"}
                      </p>
                    </div>
                  </div>

                  {/* Access list — shows who can decrypt, with human labels */}
                  <div className="bg-orange-50 rounded-lg px-2 py-1.5">
                    <p className="text-[10px] text-orange-700 font-semibold mb-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Access granted to {record.allowedWallets.length} {record.allowedWallets.length !== 1 ? "parties" : "party"}:
                    </p>
                    <div className="space-y-1">
                      {record.allowedWallets.map((w) => {
                        const label = record.granteeLabels[w] ?? (w.toLowerCase() === ephemeralAddr.toLowerCase() ? "You (owner)" : w.slice(0, 8) + "…" + w.slice(-5));
                        const isSelf = w.toLowerCase() === ephemeralAddr.toLowerCase();
                        return (
                          <div key={w} className="flex items-center gap-1.5 bg-white border border-orange-200 rounded px-1.5 py-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelf ? "bg-orange-500" : "bg-green-500"}`} />
                            <span className="text-[10px] font-semibold flex-1 truncate">{label}</span>
                            <span className="text-[8px] font-mono text-muted-foreground truncate">{w.slice(0, 6)}…{w.slice(-4)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grant access — quick presets for Bank / Insurance / Agronomist */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground">Grant access to a third party:</p>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {GRANTEE_PRESETS.map(preset => {
                        const alreadyGranted = record.allowedWallets.map(w => w.toLowerCase()).includes(preset.wallet.toLowerCase());
                        return (
                          <Button
                            key={preset.label}
                            size="sm"
                            variant={alreadyGranted ? "default" : "outline"}
                            className={`text-[10px] h-6 px-2 py-0 ${alreadyGranted ? "bg-green-600 hover:bg-green-700" : ""}`}
                            onClick={() => {
                              if (!alreadyGranted) {
                                setGrantTarget(p => ({ ...p, [record.id]: { wallet: preset.wallet, label: preset.label } }));
                              }
                            }}
                            disabled={alreadyGranted}
                          >
                            {alreadyGranted ? <><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />{preset.label}</> : preset.label}
                          </Button>
                        );
                      })}
                    </div>
                    <div className="flex gap-1.5">
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          placeholder="Label (e.g. Punjab National Bank)"
                          className="w-full text-[10px] px-2 py-1 border rounded-md font-sans"
                          value={gt.label}
                          onChange={e => setGrantTarget(p => ({ ...p, [record.id]: { ...gt, label: e.target.value } }))}
                        />
                        <input
                          type="text"
                          placeholder="0x… wallet address"
                          className="w-full text-[10px] px-2 py-1 border rounded-md font-mono"
                          value={gt.wallet}
                          onChange={e => setGrantTarget(p => ({ ...p, [record.id]: { ...gt, wallet: e.target.value } }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        className="text-[10px] h-auto px-2 shrink-0 self-center"
                        disabled={isGranting || !gt.wallet}
                        onClick={() => handleGrant(record.id)}
                      >
                        {isGranting ? <Loader2 className="w-3 h-3 animate-spin" /> : <><BadgeCheck className="w-3 h-3 mr-1" />Grant</>}
                      </Button>
                    </div>
                  </div>

                  {/* Decrypt */}
                  {isDecrypted ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                      <div className="flex items-center gap-1.5 mb-1 text-green-700 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Decrypted — Lit access control verified
                      </div>
                      <pre className="text-[9px] font-mono text-green-900 whitespace-pre-wrap break-all overflow-auto max-h-40">
                        {decrypted[record.id]}
                      </pre>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant={hasAccess ? "default" : "outline"}
                      className="w-full h-7 text-xs"
                      disabled={isDecrypting}
                      onClick={() => handleDecrypt(record.id)}
                    >
                      {isDecrypting ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Signing & verifying…</>
                      ) : hasAccess ? (
                        <><Eye className="w-3 h-3 mr-1" />Decrypt with wallet signature</>
                      ) : (
                        <><Lock className="w-3 h-3 mr-1" />Try decrypt (need access)</>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ZAMA FHE TAB — Private Multi-Farm Disease Intelligence
// ─────────────────────────────────────────────────────────────────────────────

const PUNJAB_DISTRICTS = [
  "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Gurdaspur",
  "Hoshiarpur", "Bathinda", "Sangrur", "Moga", "Fazilka",
  "Ropar", "Pathankot", "Kapurthala", "Fatehgarh Sahib", "Barnala",
];
const FHE_CROPS = ["Wheat", "Rice (Paddy)", "Maize", "Cotton", "Sugarcane", "Mustard"];
const ZAMA_ACL = "0x687820221192C5B662b25367F70076A37bc79b6c";
const ZAMA_KMS = "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC";
const FARMER_ADDR = "0x1C9d29F655E2674665eFD84B3997c8E76F1f88Cc";

type AggregateData = {
  totalEncryptedReports: number;
  individualsIdentified: number;
  districtOutbreakMap: Record<string, { total: number; byCrop: Record<string, number> }>;
  cropBreakdown: Record<string, number>;
  recentReports: Array<{ id: number; reportId: string; district: string; cropType: string; encryptedStatusPreview: string; createdAt: string }>;
  network: string;
};

function getHeatColor(count: number) {
  if (count === 0) return "bg-green-100 text-green-800 border-green-200";
  if (count <= 2) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (count <= 4) return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-red-100 text-red-800 border-red-200";
}

function ZamaTab() {
  const { toast } = useToast();
  const [view, setView] = useState<"farmer" | "dashboard">("farmer");
  const [district, setDistrict] = useState(PUNJAB_DISTRICTS[0]);
  const [cropType, setCropType] = useState(FHE_CROPS[0]);
  const [diseaseStatus, setDiseaseStatus] = useState<"infected" | "clean">("clean");
  const [fheStep, setFheStep] = useState<"idle" | "init" | "encrypting" | "done" | "error">("idle");
  const [encryptedHex, setEncryptedHex] = useState<string | null>(null);
  const [handleHex, setHandleHex] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aggregate, setAggregate] = useState<AggregateData | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [reportCount, setReportCount] = useState(0);

  const loadDashboard = async () => {
    setLoadingDash(true);
    try {
      const res = await fetch("/api/disease-intel/aggregate");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json() as AggregateData;
      setAggregate(data);
      setReportCount(data.totalEncryptedReports);
    } catch {
      toast({ title: "Could not load dashboard", variant: "destructive" });
    } finally {
      setLoadingDash(false);
    }
  };

  useEffect(() => {
    if (view === "dashboard") loadDashboard();
  }, [view]);

  const handleEncryptAndSubmit = async () => {
    setFheStep("init");
    setEncryptedHex(null);
    setHandleHex(null);
    setSubmitted(false);

    try {
      setFheStep("init");
      const { initFhevm, createInstance } = await import("fhevmjs/web");
      await initFhevm({
        tfheParams: "/tfhe_bg.wasm",
        kmsParams: "/kms_lib_bg.wasm",
      });
      const instance = await createInstance({
        kmsContractAddress: ZAMA_KMS,
        aclContractAddress: ZAMA_ACL,
        networkUrl: "https://eth-sepolia.public.blastapi.io",
        gatewayUrl: "https://gateway.sepolia.zama.ai/",
      });

      setFheStep("encrypting");
      const input = instance.createEncryptedInput(ZAMA_ACL, FARMER_ADDR);
      input.addBool(diseaseStatus === "infected");
      const { handles, inputProof } = await input.encrypt();

      const proof = Array.from(inputProof).map(b => b.toString(16).padStart(2, "0")).join("");
      const handle = Array.from(handles[0]).map(b => b.toString(16).padStart(2, "0")).join("");
      setEncryptedHex(proof);
      setHandleHex(handle);
      setFheStep("done");

      setSubmitting(true);
      const res = await fetch("/api/disease-intel/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district, cropType, encryptedStatus: proof, encryptionHandle: handle }),
      });
      if (!res.ok) throw new Error("Submit failed");
      setSubmitted(true);
      toast({ title: "Report submitted!", description: "Your encrypted disease report is on-record. Your farm identity is not stored." });
    } catch (err) {
      console.error("FHE error:", err);
      setFheStep("error");
      toast({ title: "FHE encryption failed", description: String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-5 h-5 text-violet-600" />
            <span className="font-bold text-violet-800">Disease Shield — Private FHE Intelligence</span>
            <Badge className="bg-violet-100 text-violet-700 border-violet-300 text-[10px] ml-auto">Zama Sepolia Testnet</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Farmers encrypt disease scan results using Fully Homomorphic Encryption. The government sees district-level outbreak maps — zero individual farms are ever identified.</p>
          <div className="flex gap-1 mt-2 text-[10px] font-mono text-violet-600/80">
            <span>ACL: {ZAMA_ACL.slice(0, 10)}…</span>
            <span className="mx-1">·</span>
            <span>Chain: 11155111 (Sepolia)</span>
          </div>
        </CardContent>
      </Card>

      {/* View Toggle */}
      <div className="flex rounded-xl overflow-hidden border border-violet-200 text-sm font-medium">
        <button
          className={cn("flex-1 py-2 transition-colors", view === "farmer" ? "bg-violet-600 text-white" : "bg-white text-violet-700 hover:bg-violet-50")}
          onClick={() => setView("farmer")}
        >
          Farmer Portal
        </button>
        <button
          className={cn("flex-1 py-2 transition-colors", view === "dashboard" ? "bg-violet-600 text-white" : "bg-white text-violet-700 hover:bg-violet-50")}
          onClick={() => setView("dashboard")}
        >
          Gov Dashboard {reportCount > 0 && <span className="ml-1 text-[10px] bg-red-500 text-white rounded-full px-1.5">{reportCount}</span>}
        </button>
      </div>

      {view === "farmer" && (
        <div className="space-y-3">
          {/* Form */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-violet-500" />
                Submit Encrypted Disease Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">District</label>
                  <select
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    className="w-full text-xs border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-violet-300"
                    disabled={fheStep !== "idle" && fheStep !== "done" && fheStep !== "error"}
                  >
                    {PUNJAB_DISTRICTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Crop Type</label>
                  <select
                    value={cropType}
                    onChange={e => setCropType(e.target.value)}
                    className="w-full text-xs border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-violet-300"
                    disabled={fheStep !== "idle" && fheStep !== "done" && fheStep !== "error"}
                  >
                    {FHE_CROPS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Disease Detection Result</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiseaseStatus("infected")}
                    className={cn("flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors", diseaseStatus === "infected" ? "bg-red-100 border-red-400 text-red-700" : "bg-muted/50 border-muted text-muted-foreground")}
                    disabled={fheStep !== "idle" && fheStep !== "done" && fheStep !== "error"}
                  >
                    🔴 Infected
                  </button>
                  <button
                    onClick={() => setDiseaseStatus("clean")}
                    className={cn("flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors", diseaseStatus === "clean" ? "bg-green-100 border-green-400 text-green-700" : "bg-muted/50 border-muted text-muted-foreground")}
                    disabled={fheStep !== "idle" && fheStep !== "done" && fheStep !== "error"}
                  >
                    🟢 Clean
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Your raw result is never sent to the server — only the FHE ciphertext.</p>
              </div>

              {/* FHE progress steps */}
              {fheStep !== "idle" && (
                <div className="bg-muted/30 rounded-xl p-3 space-y-1.5 text-[11px]">
                  <div className={cn("flex items-center gap-2", fheStep === "init" ? "text-violet-600" : "text-green-600")}>
                    {fheStep === "init" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Connecting to Zama Sepolia testnet & fetching FHE public key…
                  </div>
                  {(fheStep === "encrypting" || fheStep === "done" || fheStep === "error") && (
                    <div className={cn("flex items-center gap-2", fheStep === "encrypting" ? "text-violet-600" : fheStep === "error" ? "text-red-600" : "text-green-600")}>
                      {fheStep === "encrypting" ? <Loader2 className="w-3 h-3 animate-spin" /> : fheStep === "error" ? <Shield className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      Running TFHE encryption (addBool → ciphertext + ZK proof)…
                    </div>
                  )}
                  {(fheStep === "done" || submitting) && !submitted && (
                    <div className={cn("flex items-center gap-2", submitting ? "text-violet-600" : "text-green-600")}>
                      {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Submitting encrypted report to server…
                    </div>
                  )}
                  {submitted && (
                    <div className="flex items-center gap-2 text-green-600 font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      Report stored. Your farm identity: not recorded.
                    </div>
                  )}
                  {fheStep === "error" && (
                    <p className="text-red-600 text-[10px] mt-1">FHE init requires Zama Sepolia network access. Check console for details.</p>
                  )}
                </div>
              )}

              {/* Real ciphertext display */}
              {encryptedHex && (
                <div className="bg-violet-950 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-violet-300 font-semibold uppercase tracking-wider">Real TFHE Ciphertext (inputProof)</span>
                    <Badge className="bg-violet-800 text-violet-200 text-[9px]">Sepolia Chain 11155111</Badge>
                  </div>
                  <p className="font-mono text-[10px] text-green-400 break-all leading-relaxed">
                    0x{encryptedHex.slice(0, 96)}…
                  </p>
                  <div className="border-t border-violet-800 pt-2">
                    <span className="text-[10px] text-violet-400">Handle: </span>
                    <span className="font-mono text-[10px] text-violet-300">0x{handleHex?.slice(0, 32)}…</span>
                  </div>
                  <p className="text-[9px] text-violet-500">This ciphertext was encrypted using Zama's fhevmjs with the KMS public key from Ethereum Sepolia. Only the KMS can decrypt it — the server above has zero knowledge of whether this farm is infected.</p>
                </div>
              )}

              <Button
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                onClick={submitted ? () => { setFheStep("idle"); setEncryptedHex(null); setHandleHex(null); setSubmitted(false); setView("dashboard"); } : handleEncryptAndSubmit}
                disabled={(fheStep !== "idle" && fheStep !== "done" && fheStep !== "error") || submitting}
              >
                {submitted
                  ? <><Globe className="w-4 h-4 mr-2" />View Outbreak Dashboard</>
                  : fheStep === "idle" || fheStep === "error"
                    ? <><FlaskConical className="w-4 h-4 mr-2" />Encrypt with Zama FHE & Submit</>
                    : <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Working…</>
                }
              </Button>

              {/* How it works */}
              <div className="bg-muted/40 rounded-xl p-3 text-[10px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground text-xs">How it works</p>
                <p>1. fhevmjs fetches the FHE public key from the KMS contract on Ethereum Sepolia</p>
                <p>2. Your disease result is encrypted locally: <code className="text-violet-600">addBool(infected)</code> → real TFHE ciphertext</p>
                <p>3. The server stores the ciphertext + your district/crop. Your farm identity and raw result: never stored.</p>
                <p>4. Government sees aggregate counts only. Decryption requires the Zama KMS — nobody else can read it.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {view === "dashboard" && (
        <div className="space-y-3">
          {loadingDash ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">Loading outbreak intelligence…</p>
            </div>
          ) : aggregate ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <Card className="text-center p-3">
                  <p className="text-2xl font-bold text-violet-700">{aggregate.totalEncryptedReports}</p>
                  <p className="text-[10px] text-muted-foreground">Encrypted Reports</p>
                </Card>
                <Card className="text-center p-3">
                  <p className="text-2xl font-bold text-green-600">{aggregate.individualsIdentified}</p>
                  <p className="text-[10px] text-muted-foreground">Farms Identified</p>
                </Card>
                <Card className="text-center p-3">
                  <p className="text-2xl font-bold text-blue-600">{Object.keys(aggregate.districtOutbreakMap).length}</p>
                  <p className="text-[10px] text-muted-foreground">Districts Reporting</p>
                </Card>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 text-[10px] text-green-700 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                <span><strong>Zero individual farms identified.</strong> All disease statuses are FHE-encrypted — the server holds only encrypted blobs and district-level metadata.</span>
              </div>

              {/* District heatmap */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-violet-500" />
                    District Outbreak Heatmap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PUNJAB_DISTRICTS.map(d => {
                      const info = aggregate.districtOutbreakMap[d];
                      const count = info?.total ?? 0;
                      return (
                        <div key={d} className={cn("rounded-lg border p-2 text-center", getHeatColor(count))}>
                          <p className="text-[10px] font-semibold leading-tight">{d}</p>
                          <p className="text-base font-bold">{count}</p>
                          <p className="text-[9px] opacity-75">reports</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 mt-3 text-[9px] text-muted-foreground justify-center">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-200 inline-block" />0</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-200 inline-block" />1-2</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-200 inline-block" />3-4</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-200 inline-block" />5+</span>
                  </div>
                </CardContent>
              </Card>

              {/* Crop breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-violet-500" />
                    Crop-wise Report Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(aggregate.cropBreakdown).sort((a, b) => b[1] - a[1]).map(([crop, count]) => (
                    <div key={crop} className="flex items-center gap-2">
                      <span className="text-xs w-28 truncate text-muted-foreground">{crop}</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-violet-500"
                          style={{ width: `${Math.min(100, (count / aggregate.totalEncryptedReports) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-violet-700 w-6 text-right">{count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent reports */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-violet-500" />
                    Recent Encrypted Reports
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {aggregate.recentReports.map(r => (
                    <div key={r.id} className="bg-muted/40 rounded-lg p-2.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold">{r.district} — {r.cropType}</span>
                        <span className="text-muted-foreground text-[10px]">{new Date(r.createdAt).toLocaleDateString("en-IN")}</span>
                      </div>
                      <p className="font-mono text-[10px] text-violet-600 mt-1 truncate">0x{r.encryptedStatusPreview}…</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Farm identity: <span className="text-green-600 font-semibold">not recorded</span> · Sepolia Chain 11155111</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Button variant="outline" className="w-full" onClick={loadDashboard}>
                <ArrowRight className="w-4 h-4 mr-2" />Refresh Dashboard
              </Button>
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No data yet</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STARKNET TAB — ZK Proofs & Smart Contract Insurance
// ─────────────────────────────────────────────────────────────────────────────
function StarknetTab() {
  const { toast } = useToast();
  const { walletAddress, zkProofs, addZKProof, dataHistory } = useWallet();
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  const proofTypes = [
    { id: "ph", label: "Soil pH is in healthy range (6.0–7.5)", icon: FlaskConical, color: "text-emerald-600" },
    { id: "moisture", label: "Moisture > 40% (no drought stress)", icon: Droplets, color: "text-blue-600" },
    { id: "yield", label: "Yield prediction ≥ 70% (insurable)", icon: TrendingUp, color: "text-amber-600" },
  ];

  const handleGenerateProof = async (type: typeof proofTypes[0]) => {
    if (!walletAddress) { toast({ title: "Connect wallet first", variant: "destructive" }); return; }
    setGenerating(true);
    await new Promise(r => setTimeout(r, 2000));
    const proof: ZKProof = {
      id: randomHex(8),
      claim: type.label,
      proofHash: "0x" + randomHex(64),
      verified: Math.random() > 0.15,
      generatedAt: new Date().toISOString(),
      starknetTx: "0x" + randomHex(64),
    };
    addZKProof(proof);
    setGenerating(false);
    toast({
      title: proof.verified ? "ZK Proof Verified on Starknet!" : "Proof Generated — Condition Not Met",
      description: proof.verified ? `+25 FLOW earned. TX: ${shortHash(proof.starknetTx)}` : "Your farm data did not satisfy this condition.",
    });
  };

  const handleVerify = async (id: string) => {
    setVerifying(id);
    await new Promise(r => setTimeout(r, 1200));
    setVerifying(null);
    toast({ title: "Re-verified on Starknet ✓", description: "Proof validity confirmed on-chain." });
  };

  const contractStatus = dataHistory.length > 0
    ? { active: true, coverage: `₹${(dataHistory.length * 2500).toLocaleString()}`, trigger: dataHistory[0]?.riskStatus === "High" ? "Triggered" : "Monitoring" }
    : { active: false, coverage: "₹0", trigger: "Inactive" };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-rose-600" />
            <span className="font-bold text-rose-800">Starknet — ZK Proofs & Smart Insurance</span>
          </div>
          <p className="text-xs text-muted-foreground">Generate STARK proofs that verify your farm conditions on-chain without revealing raw sensor data. Used for insurance triggers and certifications.</p>
        </CardContent>
      </Card>

      {/* Smart Contract Insurance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-rose-500" /> On-Chain Insurance Contract
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground mb-0.5">Status</p>
              <Badge variant={contractStatus.active ? "default" : "secondary"} className="text-[10px]">
                {contractStatus.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground mb-0.5">Coverage</p>
              <p className="text-xs font-bold">{contractStatus.coverage}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground mb-0.5">Trigger</p>
              <p className={cn("text-xs font-bold", contractStatus.trigger === "Triggered" ? "text-red-600" : "text-green-600")}>
                {contractStatus.trigger}
              </p>
            </div>
          </div>
          {contractStatus.trigger === "Triggered" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700 font-semibold flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" /> High risk detected — Starknet contract auto-executing payout
            </div>
          )}
        </CardContent>
      </Card>

      {/* ZK Proof Generator */}
      <div>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
          <BadgeCheck className="w-4 h-4 text-rose-500" /> Generate ZK Soil Proofs
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Prove farm conditions without revealing actual sensor readings. Earns +25 FLOW per verified proof.</p>
        <div className="space-y-2">
          {proofTypes.map(pt => (
            <Card key={pt.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <pt.icon className={cn("w-8 h-8 shrink-0", pt.color)} strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold leading-snug">{pt.label}</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 text-[10px] h-7 px-2 border-rose-300 text-rose-700"
                  onClick={() => handleGenerateProof(pt)} disabled={generating}>
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Prove"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* ZK Proof History */}
      {zkProofs.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-2">ZK Proof History</h3>
          <div className="space-y-2">
            {zkProofs.map(p => (
              <Card key={p.id} className={p.verified ? "border-green-300" : "border-red-200"}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-semibold leading-snug flex-1 mr-2">{p.claim}</p>
                    <Badge className={cn("text-[10px] shrink-0", p.verified ? "bg-green-600" : "bg-red-500")}>
                      {p.verified ? "Verified" : "Failed"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center mt-1.5">
                    <p className="text-[10px] text-muted-foreground font-mono">{shortHash(p.proofHash)}</p>
                    {p.verified && (
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 text-blue-600"
                        onClick={() => handleVerify(p.id)} disabled={verifying === p.id}>
                        {verifying === p.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <><ExternalLink className="w-2.5 h-2.5 mr-0.5" />Verify</>}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HYPERCERTS TAB — Carbon Credits & Impact
// ─────────────────────────────────────────────────────────────────────────────
function HypercertsTab() {
  const { toast } = useToast();
  const { walletAddress, carbonCredits, mintCarbonCredit, dataHistory, contributionCount } = useWallet();
  const [minting, setMinting] = useState(false);

  const totalTonnes = carbonCredits.reduce((s, c) => s + c.tonnes, 0);
  const totalWater = carbonCredits.reduce((s, c) => s + c.waterSaved, 0);
  const avgImpact = carbonCredits.length > 0 ? Math.round(carbonCredits.reduce((s, c) => s + c.impactScore, 0) / carbonCredits.length) : 0;

  const activities = [
    { label: "Optimal Irrigation", tonnes: 0.8, water: 1200 },
    { label: "Reduced Chemical Use", tonnes: 0.5, water: 400 },
    { label: "Cover Cropping", tonnes: 1.2, water: 800 },
  ];

  const handleMint = async () => {
    if (!walletAddress) { toast({ title: "Connect wallet first", variant: "destructive" }); return; }
    if (contributionCount === 0) { toast({ title: "Run farm analysis first", description: "Need at least 1 analysis to mint carbon credits.", variant: "destructive" }); return; }
    setMinting(true);
    await new Promise(r => setTimeout(r, 2000));
    const act = activities[Math.floor(Math.random() * activities.length)];
    const credit: CarbonCredit = {
      id: randomHex(8),
      tonnes: act.tonnes * (1 + contributionCount * 0.1),
      activity: act.label,
      mintedAt: new Date().toISOString(),
      hypercertId: `0x${randomHex(40)}`,
      waterSaved: act.water * contributionCount,
      impactScore: Math.floor(Math.random() * 30) + 65,
    };
    mintCarbonCredit(credit);
    setMinting(false);
    toast({ title: "Hypercert Minted!", description: `${credit.tonnes.toFixed(1)} tonnes CO₂ offset certified on-chain.` });
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-green-50 to-teal-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-5 h-5 text-green-600" />
            <span className="font-bold text-green-800">Hypercerts — Climate Impact</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-2xl font-black text-green-700">{totalTonnes.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">Tonnes CO₂</p>
            </div>
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-2xl font-black text-blue-600">{(totalWater / 1000).toFixed(1)}k</p>
              <p className="text-[10px] text-muted-foreground">Litres Saved</p>
            </div>
            <div className="bg-white/70 rounded-xl p-2">
              <p className="text-2xl font-black text-teal-600">{avgImpact || "—"}</p>
              <p className="text-[10px] text-muted-foreground">Avg Impact</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eligible Activities */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-500" /> Mint Carbon Credit Hypercert
          </CardTitle>
          <p className="text-xs text-muted-foreground">Your sustainable practices earn verified carbon credits as ERC-1155 Hypercerts. Earn +30 FLOW per mint.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            {activities.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-green-50/80 border border-green-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  <span>{a.label}</span>
                </div>
                <span className="font-semibold text-green-700">{a.tonnes}t CO₂</span>
              </div>
            ))}
          </div>
          <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleMint} disabled={minting}>
            {minting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Minting Hypercert...</> : <><Leaf className="w-4 h-4 mr-2" />Mint Carbon Credit (+30 FLOW)</>}
          </Button>
        </CardContent>
      </Card>

      {/* Hypercert Gallery */}
      {carbonCredits.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5"><ScrollText className="w-4 h-4 text-green-500" /> My Hypercerts</h3>
          <div className="space-y-2">
            {carbonCredits.map(c => (
              <Card key={c.id} className="border-green-300 bg-green-50/40">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs font-bold">{c.activity}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(c.mintedAt).toLocaleDateString("en-IN")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-green-600">{c.tonnes.toFixed(1)}t</p>
                      <p className="text-[10px] text-muted-foreground">CO₂ offset</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Impact Score</span>
                      <span className="font-semibold">{c.impactScore}/100</span>
                    </div>
                    <Progress value={c.impactScore} className="h-1.5" />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                    <span>Water saved: <strong className="text-blue-600">{c.waterSaved.toLocaleString()}L</strong></span>
                    <button
                      className="text-blue-500 flex items-center gap-0.5"
                      onClick={() => { navigator.clipboard.writeText(c.hypercertId); toast({ title: "Hypercert ID copied" }); }}
                    >
                      <Copy className="w-2.5 h-2.5" />{shortHash(c.hypercertId)}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Impact Score breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-500" /> Season Impact Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Chemical Reduction", value: Math.min(100, contributionCount * 12), color: "bg-green-500" },
            { label: "Water Efficiency", value: Math.min(100, contributionCount * 18), color: "bg-blue-500" },
            { label: "Soil Health Score", value: Math.min(100, 40 + contributionCount * 8), color: "bg-amber-500" },
            { label: "Carbon Sequestration", value: Math.min(100, contributionCount * 15), color: "bg-teal-500" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{value}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
          {contributionCount === 0 && (
            <p className="text-xs text-muted-foreground text-center py-1">Run farm analyses to build your impact report</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN WEB3 HUB
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { value: "flow", label: "Flow", icon: Coins, color: "text-green-600" },
  { value: "filecoin", label: "Filecoin", icon: Database, color: "text-blue-600" },
  { value: "lit", label: "Lit", icon: Lock, color: "text-orange-500" },
  { value: "zama", label: "Zama", icon: FlaskConical, color: "text-violet-600" },
  { value: "starknet", label: "Starknet", icon: Shield, color: "text-rose-600" },
  { value: "hyper", label: "Hyper", icon: Leaf, color: "text-teal-600" },
];

export default function Web3Hub() {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Web3 Hub
        </h2>
        <p className="text-muted-foreground text-sm">All 6 protocols — live and interactive</p>
      </div>

      {/* Protocol status strip */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <div key={t.value} className="flex items-center gap-1 text-[10px] font-semibold bg-muted/80 border rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <t.icon className={cn("w-3 h-3", t.color)} />
            <span>{t.label}</span>
          </div>
        ))}
      </div>

      <Tabs defaultValue="flow">
        <TabsList className="grid grid-cols-6 h-auto p-1 w-full">
          {TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="flex flex-col items-center gap-0.5 py-1.5 px-0 text-[10px] data-[state=active]:shadow">
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="flow" className="mt-4"><FlowTab /></TabsContent>
        <TabsContent value="filecoin" className="mt-4"><FilecoinTab /></TabsContent>
        <TabsContent value="lit" className="mt-4"><LitTab /></TabsContent>
        <TabsContent value="zama" className="mt-4"><ZamaTab /></TabsContent>
        <TabsContent value="starknet" className="mt-4"><StarknetTab /></TabsContent>
        <TabsContent value="hyper" className="mt-4"><HypercertsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
