import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCreditProfile,
  submitCreditSeason,
  verifyCreditRecord,
} from "@workspace/api-client-react";
import {
  useGetMarketPrices, getGetMarketPricesQueryKey,
  useGetMarketListings, getGetMarketListingsQueryKey,
  useGetProductRecommendations, getGetProductRecommendationsQueryKey,
  useCreateMarketListing, useBuyMarketListing, useConfirmDelivery,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  BadgeCheck, TrendingUp, TrendingDown, Minus, Database, Copy,
  ChevronDown, ChevronUp, Plus, Search, Sprout, Banknote, ShieldCheck,
  Link, Store, MapPin, Tag, ShoppingBag, PlusCircle, Lock, CheckCircle2,
  FileText, Image, ExternalLink, RefreshCw, Landmark, Receipt, User,
} from "lucide-react";

const IPFS_GATEWAY = "https://gateway.lighthouse.storage/ipfs/";

function cidToUrl(cid: string | null | undefined): string | null {
  if (!cid) return null;
  return `${IPFS_GATEWAY}${cid}`;
}

function truncateCid(cid: string) {
  if (cid.length <= 16) return cid;
  return `${cid.slice(0, 10)}...${cid.slice(-6)}`;
}

function ProtocolLabsBadge({ cid, label }: { cid: string; label: string }) {
  return (
    <a
      href={cidToUrl(cid) ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 transition-colors"
    >
      <span className="font-semibold">⬡ IPFS</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono">{truncateCid(cid)}</span>
      <ExternalLink className="w-2.5 h-2.5" />
    </a>
  );
}

function EscrowBadge({ status }: { status: string }) {
  if (status === "none") return null;
  if (status === "escrowed") {
    return (
      <Badge className="bg-amber-500/20 text-amber-700 border-amber-300 flex items-center gap-1 text-[10px]">
        <Lock className="w-3 h-3" /> Funds in Escrow
      </Badge>
    );
  }
  if (status === "released") {
    return (
      <Badge className="bg-green-500/20 text-green-700 border-green-300 flex items-center gap-1 text-[10px]">
        <CheckCircle2 className="w-3 h-3" /> Escrow Released
      </Badge>
    );
  }
  return null;
}

// ─── Credit Score Arc ─────────────────────────────────────────────────────────

function ScoreArc({ score }: { score: number }) {
  const pct = (score - 300) / 600;
  const radius = 70;
  const cx = 90;
  const cy = 90;
  const startAngle = -210;
  const endAngle = -210 + 240 * pct;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcX = (angle: number) => cx + radius * Math.cos(toRad(angle));
  const arcY = (angle: number) => cy + radius * Math.sin(toRad(angle));
  const largeArc = 240 * pct > 180 ? 1 : 0;
  const color = score >= 750 ? "#22c55e" : score >= 650 ? "#3b82f6" : score >= 550 ? "#f59e0b" : "#ef4444";
  const rating = score >= 850 ? "Excellent" : score >= 750 ? "Very Good" : score >= 650 ? "Good" : score >= 550 ? "Average" : "Poor";

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="120" viewBox="0 0 180 120">
        <path
          d={`M ${arcX(startAngle)} ${arcY(startAngle)} A ${radius} ${radius} 0 1 1 ${arcX(startAngle + 240)} ${arcY(startAngle + 240)}`}
          fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round"
        />
        {pct > 0 && (
          <path
            d={`M ${arcX(startAngle)} ${arcY(startAngle)} A ${radius} ${radius} 0 ${largeArc} 1 ${arcX(endAngle)} ${arcY(endAngle)}`}
            fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="28" fontWeight="bold" fill={color}>{score}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill="#6b7280">{rating}</text>
        <text x={cx} y={cx + 28} textAnchor="middle" fontSize="9" fill="#9ca3af">300 – 900</text>
      </svg>
    </div>
  );
}

// ─── Loan Eligibility Tiers ───────────────────────────────────────────────────

const LOAN_TIERS = [
  { label: "Excellent", score: "850–900", maxAmount: 500000, rate: "7.0%", color: "text-green-600" },
  { label: "Very Good", score: "750–849", maxAmount: 300000, rate: "9.5%", color: "text-blue-600" },
  { label: "Good",      score: "650–749", maxAmount: 100000, rate: "12.0%", color: "text-blue-500" },
  { label: "Average",   score: "550–649", maxAmount: 30000,  rate: "16.0%", color: "text-amber-600" },
  { label: "Poor",      score: "300–549", maxAmount: 0,      rate: "Not eligible", color: "text-red-500" },
];

function getLoanTier(score: number) {
  if (score >= 850) return LOAN_TIERS[0];
  if (score >= 750) return LOAN_TIERS[1];
  if (score >= 650) return LOAN_TIERS[2];
  if (score >= 550) return LOAN_TIERS[3];
  return LOAN_TIERS[4];
}

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString()}`;
}

// ─── Loans Tab ────────────────────────────────────────────────────────────────

function LoansTab({ creditScore }: { creditScore: number }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [result, setResult] = useState<any>(null);
  const [applying, setApplying] = useState(false);
  const tier = getLoanTier(creditScore);
  const eligible = creditScore >= 550;

  const myLoans = useQuery<any[]>({
    queryKey: ["myLoans"],
    queryFn: async () => {
      const r = await fetch("/api/loans");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !purpose) return;
    const requested = Number(amount);
    if (requested > tier.maxAmount) {
      toast({ title: "Amount exceeds your eligible limit", description: `Max: ${formatINR(tier.maxAmount)}`, variant: "destructive" });
      return;
    }
    setApplying(true);
    try {
      const r = await fetch("/api/loans/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedAmount: requested, purpose }),
      });
      if (!r.ok) {
        const err = await r.json();
        toast({ title: "Application failed", description: err.error, variant: "destructive" });
        return;
      }
      const data = await r.json();
      setResult(data);
      myLoans.refetch();
      toast({
        title: `✅ Loan Approved: ${formatINR(data.approvedAmount)}`,
        description: `Agreement stored on IPFS (Protocol Labs). CID: ${data.ipfsCid ? truncateCid(data.ipfsCid) : "pending"}`,
      });
      setAmount("");
      setPurpose("");
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Protocol Labs banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 space-y-1">
        <p className="font-semibold flex items-center gap-1">⬡ Protocol Labs Microloan Infrastructure</p>
        <p>Credit score computed from <strong>Filecoin-archived</strong> farming data · Loan agreements stored as <strong>IPFS documents</strong> · Permanent, tamper-proof record</p>
      </div>

      {/* Loan Tier Card */}
      <Card className="border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Your Loan Eligibility</p>
              <p className="text-xs text-muted-foreground">Based on Filecoin credit history</p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-black ${tier.color}`}>{formatINR(tier.maxAmount)}</p>
              <p className="text-xs text-muted-foreground">max eligible</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white/60 rounded-lg p-2">
              <p className="text-muted-foreground">Credit Score</p>
              <p className={`font-bold text-base ${tier.color}`}>{creditScore}</p>
            </div>
            <div className="bg-white/60 rounded-lg p-2">
              <p className="text-muted-foreground">Interest Rate</p>
              <p className="font-bold text-base">{tier.rate}</p>
            </div>
            <div className="bg-white/60 rounded-lg p-2">
              <p className="text-muted-foreground">Rating</p>
              <p className="font-bold text-base">{tier.label}</p>
            </div>
          </div>

          {/* Tier ladder */}
          <div className="space-y-1 pt-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Score Tiers</p>
            {LOAN_TIERS.map((t) => (
              <div
                key={t.label}
                className={`flex items-center justify-between text-xs rounded px-2 py-1 ${
                  t.label === tier.label ? "bg-primary/10 font-semibold" : "opacity-60"
                }`}
              >
                <span className={t.color}>{t.label} ({t.score})</span>
                <span>{t.maxAmount > 0 ? `${formatINR(t.maxAmount)} @ ${t.rate}` : "Not eligible"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Apply Form */}
      {eligible ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Landmark className="w-4 h-4 text-green-600" />
              Apply for Microloan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleApply} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Loan Amount (₹) — max {formatINR(tier.maxAmount)}</Label>
                <Input
                  type="number"
                  required
                  min={1000}
                  max={tier.maxAmount}
                  placeholder={`e.g. ${Math.round(tier.maxAmount / 2).toLocaleString()}`}
                  className="h-9 text-sm"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Purpose</Label>
                <Input
                  required
                  placeholder="e.g. Seeds for Kharif season, drip irrigation"
                  className="h-9 text-sm"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-xs text-blue-700 flex items-start gap-1.5">
                <Database className="w-3 h-3 mt-0.5 shrink-0" />
                <span>Loan agreement will be stored permanently on <strong>IPFS</strong> via Lighthouse (Protocol Labs) as immutable proof.</span>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={applying}>
                {applying ? "Uploading agreement to IPFS..." : "⬡ Apply — Store Agreement on Filecoin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2">
          <CardContent className="py-6 text-center space-y-2">
            <Landmark className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">Score too low for loans</p>
            <p className="text-xs text-muted-foreground">Minimum 550 needed. Add more season records to improve your score.</p>
          </CardContent>
        </Card>
      )}

      {/* Latest loan result */}
      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="font-bold text-green-700">Loan Approved!</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Approved Amount</p>
                <p className="font-bold text-base text-green-700">{formatINR(result.approvedAmount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Monthly EMI</p>
                <p className="font-bold text-base">{formatINR(result.emiAmount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Interest Rate</p>
                <p className="font-semibold">{result.interestRate}% p.a.</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tenure</p>
                <p className="font-semibold">{result.tenureMonths} months</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Total Repayable</p>
                <p className="font-semibold">{formatINR(result.emiAmount * result.tenureMonths)}</p>
              </div>
            </div>
            {result.ipfsCid && (
              <div className="border-t pt-2 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">IPFS Agreement Record</p>
                <ProtocolLabsBadge cid={result.ipfsCid} label="loan-agreement" />
                <p className="text-[10px] text-muted-foreground">Share this CID with lender as immutable proof</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Past loans */}
      {myLoans.data && myLoans.data.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Receipt className="w-3.5 h-3.5" /> Loan History
          </p>
          {myLoans.data.map((loan: any) => (
            <Card key={loan.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold">{formatINR(loan.approvedAmount)}</p>
                    <p className="text-xs text-muted-foreground">{loan.purpose}</p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-100 text-green-700 text-[10px]">{loan.status}</Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(loan.createdAt).toLocaleDateString("en-IN")}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>EMI: <span className="font-medium text-foreground">{formatINR(loan.emiAmount)}/mo</span></span>
                  <span>{loan.interestRate}% · {loan.tenureMonths}mo</span>
                </div>
                {loan.ipfsCid && <ProtocolLabsBadge cid={loan.ipfsCid} label="agreement" />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Credit Tab ───────────────────────────────────────────────────────────────

const PRACTICES = [
  "Crop Rotation","Drip Irrigation","Organic Fertilizer","Zero Tillage",
  "Cover Cropping","Integrated Pest Management","Mulching","Rainwater Harvesting",
  "Solar Powered Irrigation","AI-guided Sowing",
];

function CreditSeasonCard({ season }: { season: any }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const ratingColor =
    season.creditScore >= 750 ? "bg-green-100 text-green-800"
    : season.creditScore >= 650 ? "bg-blue-100 text-blue-800"
    : season.creditScore >= 550 ? "bg-amber-100 text-amber-800"
    : "bg-red-100 text-red-800";

  return (
    <Card className="border border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{season.season}</p>
            <p className="text-xs text-muted-foreground">{season.cropGrown} · {season.acresPlanted} acres</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${ratingColor}`}>
              {season.creditScore} · {season.creditRating}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/40 rounded-lg p-2">
            <p className="text-xs text-muted-foreground">Yield</p>
            <p className="text-sm font-bold">{season.yieldKgPerAcre} kg/ac</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-2">
            <p className="text-xs text-muted-foreground">Soil</p>
            <p className="text-sm font-bold">{season.soilHealthScore}/100</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-2">
            <p className="text-xs text-muted-foreground">Practices</p>
            <p className="text-sm font-bold">{season.practicesFollowed?.length || 0}</p>
          </div>
        </div>

        {expanded && (
          <div className="space-y-3 pt-1">
            <Separator />
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">AI ASSESSMENT</p>
              <p className="text-xs text-foreground leading-relaxed">{season.scoreBreakdown?.summary}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">SCORE BREAKDOWN</p>
              <div className="space-y-1.5">
                {[
                  { label: "Yield Performance", value: season.scoreBreakdown?.yieldScore, max: 25 },
                  { label: "Soil Health", value: season.scoreBreakdown?.soilHealthScore, max: 20 },
                  { label: "Practices", value: season.scoreBreakdown?.practicesScore, max: 20 },
                  { label: "Consistency", value: season.scoreBreakdown?.consistencyScore, max: 20 },
                  { label: "Repayment", value: season.scoreBreakdown?.repaymentScore, max: 15 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="text-xs w-28 text-muted-foreground">{item.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${((item.value || 0) / item.max) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono w-10 text-right">{(item.value || 0).toFixed(1)}/{item.max}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-muted/60 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Database className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">FILECOIN RECORD</p>
              </div>
              <p className="text-xs font-mono break-all text-foreground">{season.ipfsCid}</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => { navigator.clipboard.writeText(season.ipfsCid); toast({ title: "CID copied" }); }}>
                  <Copy className="w-3 h-3" /> Copy CID
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => window.open(season.ipfsUrl, "_blank")}>
                  <Link className="w-3 h-3" /> View on IPFS
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddSeasonForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    season: "", cropGrown: "", acresPlanted: "", yieldKgPerAcre: "",
    soilHealthScore: "", weatherChallenges: "", inputCostPerAcre: "",
    revenuePerAcre: "", loanTaken: "", loanRepaid: "",
  });
  const [selectedPractices, setSelectedPractices] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: (data: any) => submitCreditSeason(data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["creditProfile"] });
      queryClient.invalidateQueries({ queryKey: ["myLoans"] });
      toast({ title: `Credit Score: ${data.creditScore} (${data.creditRating})`, description: `Season archived to Filecoin. CID: ${data.ipfsCid.substring(0, 20)}...` });
      onClose();
    },
    onError: () => toast({ title: "Failed to submit season", variant: "destructive" }),
  });

  const togglePractice = (p: string) => setSelectedPractices(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const handleSubmit = () => {
    if (!form.season || !form.cropGrown || !form.acresPlanted || !form.yieldKgPerAcre || !form.soilHealthScore) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    mutation.mutate({
      season: form.season, cropGrown: form.cropGrown,
      acresPlanted: parseFloat(form.acresPlanted), yieldKgPerAcre: parseFloat(form.yieldKgPerAcre),
      soilHealthScore: parseFloat(form.soilHealthScore), practicesFollowed: selectedPractices,
      weatherChallenges: form.weatherChallenges || null,
      inputCostPerAcre: form.inputCostPerAcre ? parseFloat(form.inputCostPerAcre) : null,
      revenuePerAcre: form.revenuePerAcre ? parseFloat(form.revenuePerAcre) : null,
      loanTaken: form.loanTaken ? parseFloat(form.loanTaken) : null,
      loanRepaid: form.loanRepaid ? parseFloat(form.loanRepaid) : null,
    });
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sprout className="w-4 h-4 text-green-600" /> Add Season Record
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Season *", key: "season", placeholder: "e.g. Kharif 2024" },
            { label: "Crop Grown *", key: "cropGrown", placeholder: "e.g. Wheat" },
          ].map(({ label, key, placeholder }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input placeholder={placeholder} className="h-9 text-sm"
                value={(form as any)[key]} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          {[
            { label: "Acres Planted *", key: "acresPlanted", placeholder: "e.g. 2.5", type: "number" },
            { label: "Yield (kg/acre) *", key: "yieldKgPerAcre", placeholder: "e.g. 1800", type: "number" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input type={type} placeholder={placeholder} className="h-9 text-sm"
                value={(form as any)[key]} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Soil Health Score (0–100) *</Label>
            <Input type="number" min={0} max={100} placeholder="e.g. 72" className="h-9 text-sm"
              value={form.soilHealthScore} onChange={(e) => setForm(f => ({ ...f, soilHealthScore: e.target.value }))} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Weather Challenges (optional)</Label>
            <Input placeholder="e.g. Late monsoon, heatwave in June" className="h-9 text-sm"
              value={form.weatherChallenges} onChange={(e) => setForm(f => ({ ...f, weatherChallenges: e.target.value }))} />
          </div>
          {[
            { label: "Input Cost (₹/acre)", key: "inputCostPerAcre", placeholder: "e.g. 8000" },
            { label: "Revenue (₹/acre)", key: "revenuePerAcre", placeholder: "e.g. 22000" },
            { label: "Loan Taken (₹)", key: "loanTaken", placeholder: "e.g. 50000" },
            { label: "Loan Repaid (₹)", key: "loanRepaid", placeholder: "e.g. 50000" },
          ].map(({ label, key, placeholder }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input type="number" placeholder={placeholder} className="h-9 text-sm"
                value={(form as any)[key]} onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
        </div>

        <div>
          <Label className="text-xs">Sustainable Practices</Label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PRACTICES.map((p) => (
              <button key={p} type="button" onClick={() => togglePractice(p)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedPractices.includes(p)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Scoring & Archiving to Filecoin..." : "Submit & Get Credit Score"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VerifyCidSection() {
  const [cid, setCid] = useState("");
  const [searched, setSearched] = useState("");
  const { toast } = useToast();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["verifyCid", searched],
    queryFn: () => verifyCreditRecord(searched),
    enabled: searched.length > 10,
    retry: false,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-500" /> Verify CID (For Banks / Auditors)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Enter any Filecoin CID to independently verify a farmer's season record.</p>
        <div className="flex gap-2">
          <Input placeholder="bafybeig..." className="h-9 text-xs font-mono" value={cid} onChange={(e) => setCid(e.target.value)} />
          <Button size="sm" className="gap-1" onClick={() => { if (!cid.trim()) return; setSearched(cid.trim()); }}>
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>
        {isLoading && searched && <p className="text-xs text-muted-foreground animate-pulse">Verifying on-chain record...</p>}
        {isError && searched && (
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs text-red-600 font-medium">No record found for this CID.</p>
          </div>
        )}
        {data && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-green-600" />
              <p className="text-xs font-bold text-green-700">Record Verified on Filecoin</p>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span className="text-muted-foreground">Season</span><span className="font-medium">{(data as any).season}</span>
              <span className="text-muted-foreground">Crop</span><span className="font-medium">{(data as any).cropGrown}</span>
              <span className="text-muted-foreground">Yield</span><span className="font-medium">{(data as any).yieldKgPerAcre} kg/acre</span>
              <span className="text-muted-foreground">Credit Score</span><span className="font-bold text-green-700">{(data as any).creditScore} · {(data as any).creditRating}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Market Tab ───────────────────────────────────────────────────────────────

function MarketTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listingOpen, setListingOpen] = useState(false);
  const [buyDialogId, setBuyDialogId] = useState<number | null>(null);
  const [buyerNameInput, setBuyerNameInput] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [listingForm, setListingForm] = useState({
    title: "", description: "", crop: "", price: "", quantity: "",
    unit: "kg", sellerName: "", location: "", imageBase64: "",
  });

  const { data: listings, isLoading: loadingListings } = useGetMarketListings({ query: { queryKey: getGetMarketListingsQueryKey() } });
  const createListing = useCreateMarketListing();
  const buyListing = useBuyMarketListing();
  const confirmDelivery = useConfirmDelivery();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setPreviewImage(base64);
      setListingForm(f => ({ ...f, imageBase64: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault();
    createListing.mutate({
      data: { ...listingForm, price: Number(listingForm.price), quantity: Number(listingForm.quantity), imageBase64: listingForm.imageBase64 || undefined }
    }, {
      onSuccess: () => {
        toast({ title: "Listing Created on IPFS", description: "Your listing is stored permanently on IPFS via Lighthouse (Protocol Labs)." });
        setListingOpen(false);
        setPreviewImage(null);
        setListingForm({ title: "", description: "", crop: "", price: "", quantity: "", unit: "kg", sellerName: "", location: "", imageBase64: "" });
        queryClient.invalidateQueries({ queryKey: getGetMarketListingsQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to create listing.", variant: "destructive" }),
    });
  };

  const handleBuy = () => {
    if (buyDialogId == null) return;
    buyListing.mutate({ id: buyDialogId, data: { buyerName: buyerNameInput || "Anonymous Buyer" } }, {
      onSuccess: () => {
        toast({ title: "Funds Locked in Escrow", description: "Payment held in Filecoin FVM escrow. Released after delivery confirmation." });
        setBuyDialogId(null);
        setBuyerNameInput("");
        queryClient.invalidateQueries({ queryKey: getGetMarketListingsQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Purchase failed.", variant: "destructive" }),
    });
  };

  const handleConfirmDelivery = (id: number) => {
    confirmDelivery.mutate({ id }, {
      onSuccess: (data) => {
        toast({ title: "Delivery Confirmed — Escrow Released!", description: `Filecoin receipt: ${data.receiptCid ? truncateCid(data.receiptCid) : "stored"}` });
        queryClient.invalidateQueries({ queryKey: getGetMarketListingsQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Confirmation failed.", variant: "destructive" }),
    });
  };

  const selectedListing = listings?.find(l => l.id === buyDialogId);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 space-y-1">
        <p className="font-semibold flex items-center gap-1">⬡ Protocol Labs Web3 P2P Market</p>
        <p>Photos stored on <strong>IPFS</strong> · Listings on <strong>Filecoin</strong> · Escrow via <strong>FVM</strong> · Receipts permanent on-chain</p>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">Direct from Farmers</h3>
        <Dialog open={listingOpen} onOpenChange={setListingOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="w-4 h-4 mr-1" /> Sell Produce</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create IPFS-Backed Listing</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">Your listing & photo stored permanently on IPFS via Lighthouse (Protocol Labs)</p>
            </DialogHeader>
            <form onSubmit={handleCreateListing} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Produce Photo (stored on IPFS)</Label>
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}>
                  {previewImage ? (
                    <img src={previewImage} alt="Preview" className="mx-auto max-h-32 object-cover rounded" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Image className="w-8 h-8" />
                      <span className="text-xs">Click to upload photo</span>
                      <span className="text-[10px]">Stored permanently on IPFS</span>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input required value={listingForm.title} onChange={e => setListingForm({ ...listingForm, title: e.target.value })} placeholder="e.g. Organic Basmati Wheat" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={listingForm.description} onChange={e => setListingForm({ ...listingForm, description: e.target.value })} placeholder="Grade, quality details..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Crop</Label><Input required value={listingForm.crop} onChange={e => setListingForm({ ...listingForm, crop: e.target.value })} /></div>
                <div className="space-y-2"><Label>Price (₹)</Label><Input type="number" required value={listingForm.price} onChange={e => setListingForm({ ...listingForm, price: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Quantity</Label><Input type="number" required value={listingForm.quantity} onChange={e => setListingForm({ ...listingForm, quantity: e.target.value })} /></div>
                <div className="space-y-2"><Label>Unit</Label><Input required value={listingForm.unit} onChange={e => setListingForm({ ...listingForm, unit: e.target.value })} placeholder="kg, quintal" /></div>
              </div>
              <div className="space-y-2"><Label>Your Name</Label><Input required value={listingForm.sellerName} onChange={e => setListingForm({ ...listingForm, sellerName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Location</Label><Input required value={listingForm.location} onChange={e => setListingForm({ ...listingForm, location: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={createListing.isPending}>
                {createListing.isPending ? "Uploading to IPFS..." : "⬡ Post on IPFS + Filecoin"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={buyDialogId != null} onOpenChange={(open) => { if (!open) setBuyDialogId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock Funds in FVM Escrow</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Payment held in Filecoin FVM escrow smart contract. Released only after delivery confirmation.</p>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <p className="font-semibold">{selectedListing.title}</p>
                <p className="text-muted-foreground">{selectedListing.quantity} {selectedListing.unit} of {selectedListing.crop}</p>
                <p className="text-primary font-bold text-lg">₹{(selectedListing.price * selectedListing.quantity).toLocaleString()}</p>
              </div>
              <div className="space-y-2">
                <Label>Your Name (Buyer)</Label>
                <Input value={buyerNameInput} onChange={e => setBuyerNameInput(e.target.value)} placeholder="Enter your name" />
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                <span>Escrow agreement stored permanently on <strong>IPFS</strong> as verifiable record.</span>
              </div>
              <Button className="w-full" onClick={handleBuy} disabled={buyListing.isPending}>
                {buyListing.isPending ? "Creating Escrow..." : "⬡ Lock in Filecoin Escrow"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-4">
        {loadingListings
          ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
          : listings?.length === 0
            ? (
              <div className="text-center py-12 text-muted-foreground">
                <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No listings yet. Be the first to sell!</p>
              </div>
            )
            : listings?.map((listing) => (
              <Card key={listing.id} className="overflow-hidden border-border">
                {listing.imageCid && (
                  <div className="h-40 w-full overflow-hidden bg-muted">
                    <img src={`${IPFS_GATEWAY}${listing.imageCid}`} alt={listing.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base leading-tight mb-1 truncate">{listing.title}</CardTitle>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">{listing.crop}</Badge>
                        <EscrowBadge status={listing.escrowStatus} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-primary">₹{listing.price}</p>
                      <p className="text-xs text-muted-foreground">per {listing.unit}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-2">
                  <div className="flex justify-between text-sm">
                    <div className="space-y-0.5">
                      <p className="flex items-center text-muted-foreground text-xs"><User className="w-3 h-3 mr-1" />{listing.sellerName}</p>
                      <p className="flex items-center text-muted-foreground text-xs"><MapPin className="w-3 h-3 mr-1" />{listing.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="font-bold text-sm">{listing.quantity} {listing.unit}</p>
                    </div>
                  </div>
                  <div className="space-y-1 pt-1 border-t border-muted">
                    {listing.imageCid && <ProtocolLabsBadge cid={listing.imageCid} label="photo" />}
                    {listing.receiptCid && listing.escrowStatus === "escrowed" && <ProtocolLabsBadge cid={listing.receiptCid} label="escrow" />}
                    {listing.receiptCid && listing.escrowStatus === "released" && (
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-green-600" />
                        <ProtocolLabsBadge cid={listing.receiptCid} label="receipt" />
                      </div>
                    )}
                  </div>
                  {listing.buyerName && <p className="text-xs text-muted-foreground">Buyer: <span className="font-medium text-foreground">{listing.buyerName}</span></p>}
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  {listing.status !== "sold" ? (
                    <Button className="w-full" onClick={() => setBuyDialogId(listing.id)} disabled={buyListing.isPending}>
                      <Lock className="w-3.5 h-3.5 mr-1.5" /> Buy with Escrow
                    </Button>
                  ) : listing.escrowStatus === "escrowed" ? (
                    <Button className="w-full" variant="outline" onClick={() => handleConfirmDelivery(listing.id)} disabled={confirmDelivery.isPending}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      {confirmDelivery.isPending ? "Minting Receipt..." : "Confirm Delivery & Release Escrow"}
                    </Button>
                  ) : listing.escrowStatus === "released" ? (
                    <div className="w-full text-center text-xs text-green-600 font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Trade Complete · Receipt on Filecoin
                    </div>
                  ) : (
                    <Button className="w-full" variant="secondary" disabled>Unavailable</Button>
                  )}
                </CardFooter>
              </Card>
            ))}
      </div>
    </div>
  );
}

// ─── Mandi Prices Tab ─────────────────────────────────────────────────────────

function MandiTab() {
  const queryClient = useQueryClient();
  const { data: prices, isLoading, refetch } = useGetMarketPrices({ query: { queryKey: getGetMarketPricesQueryKey() } });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">eNAM-sourced · refreshes every 60s</p>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
          onClick={() => { queryClient.invalidateQueries({ queryKey: getGetMarketPricesQueryKey() }); refetch(); }}>
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {isLoading
          ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : prices?.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex border-l-4 border-primary">
                  <div className="p-4 flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-lg">{item.crop}</h3>
                      <div className={`flex items-center text-sm font-bold ${item.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {item.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                        {Math.abs(item.change)}%
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-black">₹{item.price}</span>
                      <span className="text-sm text-muted-foreground">/ {item.unit}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center"><Store className="w-3 h-3 mr-1" />{item.market}</span>
                      <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" />{item.state}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}

// ─── Agri Inputs Tab ─────────────────────────────────────────────────────────

function AgriInputsTab() {
  const { data: products, isLoading } = useGetProductRecommendations({ query: { queryKey: getGetProductRecommendationsQueryKey() } });

  return (
    <div className="space-y-3">
      <div className="bg-accent/10 p-3 rounded-lg border border-accent/20">
        <p className="text-sm text-accent-foreground font-medium flex items-center">
          <Tag className="w-4 h-4 mr-2" /> AI-recommended inputs based on your soil profile
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {isLoading
          ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
          : products?.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <CardContent className="p-3 flex-1 space-y-2">
                <Badge variant="secondary" className="text-[10px]">{p.category}</Badge>
                <p className="text-xs font-bold leading-tight">{p.name}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{p.description}</p>
                <p className="text-xs font-medium text-primary">₹{p.price}</p>
                <p className="text-[10px] text-muted-foreground italic">{p.reason}</p>
              </CardContent>
              <CardFooter className="p-3 pt-0">
                <Button size="sm" className="w-full text-xs h-8">
                  <ShoppingBag className="w-3 h-3 mr-1" /> Buy Input
                </Button>
              </CardFooter>
            </Card>
          ))}
      </div>
    </div>
  );
}

// ─── Main Finance & Trade Page ────────────────────────────────────────────────

export default function FinanceTrade() {
  const [showForm, setShowForm] = useState(false);
  const { data: profile, isLoading } = useQuery({
    queryKey: ["creditProfile"],
    queryFn: () => getCreditProfile(),
  });

  const trendIcon =
    profile?.trend === "Improving" ? <TrendingUp className="w-4 h-4 text-green-500" />
    : profile?.trend === "Declining" ? <TrendingDown className="w-4 h-4 text-red-500" />
    : <Minus className="w-4 h-4 text-muted-foreground" />;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Finance & Trade</h2>
          <p className="text-muted-foreground text-sm">Credit · Loans · Market · Prices</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-blue-600 font-medium bg-blue-50 border border-blue-200 rounded-full px-2 py-1">
          <span>⬡</span> Protocol Labs
        </div>
      </div>

      <Tabs defaultValue="credit" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-5 h-auto p-1">
          <TabsTrigger value="credit" className="py-1.5 text-[11px]">Credit</TabsTrigger>
          <TabsTrigger value="loans" className="py-1.5 text-[11px]">Loans</TabsTrigger>
          <TabsTrigger value="market" className="py-1.5 text-[11px]">Market</TabsTrigger>
          <TabsTrigger value="mandi" className="py-1.5 text-[11px]">Prices</TabsTrigger>
        </TabsList>

        {/* ── CREDIT ───────────────────────────────────────────────────── */}
        <TabsContent value="credit" className="space-y-4">
          {isLoading ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground text-sm animate-pulse">Loading credit profile...</CardContent></Card>
          ) : profile && profile.totalSeasons > 0 ? (
            <Card className="border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="pt-5 pb-4">
                <ScoreArc score={profile.overallScore} />
                <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                  <div><p className="text-muted-foreground">Seasons</p><p className="font-bold text-base">{profile.totalSeasons}</p></div>
                  <div><p className="text-muted-foreground">Avg Yield</p><p className="font-bold text-base">{profile.averageYield} kg/ac</p></div>
                  <div><p className="text-muted-foreground">Soil Health</p><p className="font-bold text-base">{profile.averageSoilHealth}/100</p></div>
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  {trendIcon}
                  <span className="text-xs text-muted-foreground">{profile.trend}</span>
                </div>
                <div className="mt-4 bg-white/60 dark:bg-black/20 rounded-xl p-3 flex items-start gap-2">
                  <Banknote className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground leading-relaxed">{profile.loanEligibility}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2">
              <CardContent className="py-8 text-center space-y-2">
                <Database className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">No credit history yet</p>
                <p className="text-xs text-muted-foreground">Add your first season to build a verifiable farming track record on Filecoin</p>
              </CardContent>
            </Card>
          )}

          {showForm ? (
            <AddSeasonForm onClose={() => setShowForm(false)} />
          ) : (
            <Button className="w-full gap-2" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> Add Season Record
            </Button>
          )}

          {profile?.seasons && profile.seasons.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Season History</p>
              {profile.seasons.map((s: any) => <CreditSeasonCard key={s.id} season={s} />)}
            </div>
          )}

          <VerifyCidSection />
        </TabsContent>

        {/* ── LOANS ────────────────────────────────────────────────────── */}
        <TabsContent value="loans">
          <LoansTab creditScore={profile?.overallScore ?? 0} />
        </TabsContent>

        {/* ── MARKET ───────────────────────────────────────────────────── */}
        <TabsContent value="market">
          <MarketTab />
        </TabsContent>

        {/* ── MANDI PRICES ─────────────────────────────────────────────── */}
        <TabsContent value="mandi">
          <MandiTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
