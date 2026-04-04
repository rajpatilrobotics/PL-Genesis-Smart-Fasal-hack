import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCreditProfile,
  submitCreditSeason,
  verifyCreditRecord,
  useGetInsuranceRisk, getGetInsuranceRiskQueryKey,
  useGetInsuranceClaims, getGetInsuranceClaimsQueryKey,
  useCreateInsuranceClaim,
  useCancelInsurancePolicy,
  useResetInsuranceDemo,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/wallet-context";
import {
  BadgeCheck, TrendingUp, TrendingDown, Minus, Database, Copy,
  ChevronDown, ChevronUp, Plus, Search, Sprout, Banknote, ShieldCheck,
  Link, ExternalLink, Landmark, Receipt, CheckCircle2,
  ShieldAlert, AlertCircle, FileText, Zap, XCircle, RotateCcw, Trash2,
} from "lucide-react";

const IPFS_GATEWAY = "https://gateway.lighthouse.storage/ipfs/";

function truncateCid(cid: string) {
  if (cid.length <= 16) return cid;
  return `${cid.slice(0, 10)}...${cid.slice(-6)}`;
}

function ProtocolLabsBadge({ cid, label }: { cid: string; label: string }) {
  return (
    <a
      href={`${IPFS_GATEWAY}${cid}`}
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

// ─── Loan Tiers ───────────────────────────────────────────────────────────────

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

// ─── Credit Season Card ───────────────────────────────────────────────────────

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

// ─── Add Season Form ──────────────────────────────────────────────────────────

const PRACTICES = [
  "Crop Rotation", "Drip Irrigation", "Organic Fertilizer", "Zero Tillage",
  "Cover Cropping", "Integrated Pest Management", "Mulching", "Rainwater Harvesting",
  "Solar Powered Irrigation", "AI-guided Sowing",
];

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
          <div className="space-y-1">
            <Label className="text-xs">Season *</Label>
            <Input placeholder="e.g. Kharif 2024" className="h-9 text-sm"
              value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Crop Grown *</Label>
            <Input placeholder="e.g. Wheat" className="h-9 text-sm"
              value={form.cropGrown} onChange={e => setForm(f => ({ ...f, cropGrown: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Acres Planted *</Label>
            <Input type="number" placeholder="e.g. 2.5" className="h-9 text-sm"
              value={form.acresPlanted} onChange={e => setForm(f => ({ ...f, acresPlanted: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Yield (kg/acre) *</Label>
            <Input type="number" placeholder="e.g. 1800" className="h-9 text-sm"
              value={form.yieldKgPerAcre} onChange={e => setForm(f => ({ ...f, yieldKgPerAcre: e.target.value }))} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Soil Health Score (0–100) *</Label>
            <Input type="number" min={0} max={100} placeholder="e.g. 72" className="h-9 text-sm"
              value={form.soilHealthScore} onChange={e => setForm(f => ({ ...f, soilHealthScore: e.target.value }))} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Weather Challenges (optional)</Label>
            <Input placeholder="e.g. Late monsoon, heatwave in June" className="h-9 text-sm"
              value={form.weatherChallenges} onChange={e => setForm(f => ({ ...f, weatherChallenges: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Input Cost (₹/acre)</Label>
            <Input type="number" placeholder="e.g. 8000" className="h-9 text-sm"
              value={form.inputCostPerAcre} onChange={e => setForm(f => ({ ...f, inputCostPerAcre: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Revenue (₹/acre)</Label>
            <Input type="number" placeholder="e.g. 22000" className="h-9 text-sm"
              value={form.revenuePerAcre} onChange={e => setForm(f => ({ ...f, revenuePerAcre: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Loan Taken (₹)</Label>
            <Input type="number" placeholder="e.g. 50000" className="h-9 text-sm"
              value={form.loanTaken} onChange={e => setForm(f => ({ ...f, loanTaken: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Loan Repaid (₹)</Label>
            <Input type="number" placeholder="e.g. 50000" className="h-9 text-sm"
              value={form.loanRepaid} onChange={e => setForm(f => ({ ...f, loanRepaid: e.target.value }))} />
          </div>
        </div>

        <div>
          <Label className="text-xs">Sustainable Practices</Label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PRACTICES.map(p => (
              <button key={p} type="button" onClick={() => togglePractice(p)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedPractices.includes(p)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                }`}>{p}</button>
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

// ─── Credit Tab ───────────────────────────────────────────────────────────────

function CreditTab() {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const [cid, setCid] = useState("");
  const [searched, setSearched] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["creditProfile"],
    queryFn: () => getCreditProfile(),
  });

  const verifyQuery = useQuery({
    queryKey: ["verifyCid", searched],
    queryFn: () => verifyCreditRecord(searched),
    enabled: searched.length > 10,
    retry: false,
  });

  const trendIcon =
    profile?.trend === "Improving" ? <TrendingUp className="w-4 h-4 text-green-500" />
    : profile?.trend === "Declining" ? <TrendingDown className="w-4 h-4 text-red-500" />
    : <Minus className="w-4 h-4 text-muted-foreground" />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        <p className="font-semibold flex items-center gap-1">⬡ Filecoin-Verified Credit History</p>
        <p>Every season record archived permanently on <strong>IPFS via Lighthouse</strong> (Protocol Labs) — tamper-proof, shareable with any bank or lender.</p>
      </div>

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

      {showForm
        ? <AddSeasonForm onClose={() => setShowForm(false)} />
        : <Button className="w-full gap-2" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Season Record</Button>
      }

      {profile?.seasons && profile.seasons.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Season History</p>
          {profile.seasons.map((s: any) => <CreditSeasonCard key={s.id} season={s} />)}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-500" /> Verify CID (For Banks / Auditors)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Enter any Filecoin CID to independently verify a farmer's season record.</p>
          <div className="flex gap-2">
            <Input placeholder="bafybeig..." className="h-9 text-xs font-mono" value={cid} onChange={e => setCid(e.target.value)} />
            <Button size="sm" onClick={() => { if (cid.trim()) setSearched(cid.trim()); }}>
              <Search className="w-3.5 h-3.5" />
            </Button>
          </div>
          {verifyQuery.isLoading && searched && <p className="text-xs text-muted-foreground animate-pulse">Verifying on-chain record...</p>}
          {verifyQuery.isError && searched && (
            <div className="bg-red-50 rounded-lg p-3"><p className="text-xs text-red-600 font-medium">No record found for this CID.</p></div>
          )}
          {verifyQuery.data && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-green-600" />
                <p className="text-xs font-bold text-green-700">Record Verified on Filecoin</p>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-muted-foreground">Season</span><span className="font-medium">{(verifyQuery.data as any).season}</span>
                <span className="text-muted-foreground">Crop</span><span className="font-medium">{(verifyQuery.data as any).cropGrown}</span>
                <span className="text-muted-foreground">Yield</span><span className="font-medium">{(verifyQuery.data as any).yieldKgPerAcre} kg/acre</span>
                <span className="text-muted-foreground">Credit Score</span><span className="font-bold text-green-700">{(verifyQuery.data as any).creditScore} · {(verifyQuery.data as any).creditRating}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
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
      toast({ title: `Loan Approved: ${formatINR(data.approvedAmount)}`, description: `Agreement stored on IPFS. CID: ${data.ipfsCid ? truncateCid(data.ipfsCid) : "pending"}` });
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
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
        <p className="font-semibold flex items-center gap-1">⬡ Protocol Labs Microloan Infrastructure</p>
        <p>Credit score from <strong>Filecoin-archived</strong> farming data · Loan agreements stored as <strong>IPFS documents</strong> · Permanent, tamper-proof</p>
      </div>

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
            <div className="bg-white/60 rounded-lg p-2"><p className="text-muted-foreground">Credit Score</p><p className={`font-bold text-base ${tier.color}`}>{creditScore}</p></div>
            <div className="bg-white/60 rounded-lg p-2"><p className="text-muted-foreground">Interest Rate</p><p className="font-bold text-base">{tier.rate}</p></div>
            <div className="bg-white/60 rounded-lg p-2"><p className="text-muted-foreground">Rating</p><p className="font-bold text-base">{tier.label}</p></div>
          </div>
          <div className="space-y-1 pt-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Score Tiers</p>
            {LOAN_TIERS.map(t => (
              <div key={t.label} className={`flex items-center justify-between text-xs rounded px-2 py-1 ${t.label === tier.label ? "bg-primary/10 font-semibold" : "opacity-60"}`}>
                <span className={t.color}>{t.label} ({t.score})</span>
                <span>{t.maxAmount > 0 ? `${formatINR(t.maxAmount)} @ ${t.rate}` : "Not eligible"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {eligible ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Landmark className="w-4 h-4 text-green-600" /> Apply for Microloan</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleApply} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Loan Amount (₹) — max {formatINR(tier.maxAmount)}</Label>
                <Input type="number" required min={1000} max={tier.maxAmount}
                  placeholder={`e.g. ${Math.round(tier.maxAmount / 2).toLocaleString()}`}
                  className="h-9 text-sm" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Purpose</Label>
                <Input required placeholder="e.g. Seeds for Kharif season, drip irrigation"
                  className="h-9 text-sm" value={purpose} onChange={e => setPurpose(e.target.value)} />
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-xs text-blue-700 flex items-start gap-1.5">
                <Database className="w-3 h-3 mt-0.5 shrink-0" />
                <span>Loan agreement stored permanently on <strong>IPFS</strong> via Lighthouse (Protocol Labs).</span>
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
            <p className="text-xs text-muted-foreground">Minimum score 550 needed. Add more season records to improve.</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600" /><p className="font-bold text-green-700">Loan Approved!</p></div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-muted-foreground">Approved Amount</p><p className="font-bold text-base text-green-700">{formatINR(result.approvedAmount)}</p></div>
              <div><p className="text-muted-foreground">Monthly EMI</p><p className="font-bold text-base">{formatINR(result.emiAmount)}</p></div>
              <div><p className="text-muted-foreground">Interest Rate</p><p className="font-semibold">{result.interestRate}% p.a.</p></div>
              <div><p className="text-muted-foreground">Tenure</p><p className="font-semibold">{result.tenureMonths} months</p></div>
              <div className="col-span-2"><p className="text-muted-foreground">Total Repayable</p><p className="font-semibold">{formatINR(result.emiAmount * result.tenureMonths)}</p></div>
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

      {myLoans.data && myLoans.data.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> Loan History</p>
          {myLoans.data.map((loan: any) => (
            <Card key={loan.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div><p className="text-sm font-semibold">{formatINR(loan.approvedAmount)}</p><p className="text-xs text-muted-foreground">{loan.purpose}</p></div>
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

// ─── Insurance Tab ────────────────────────────────────────────────────────────

// ─── Plan definitions (mirror server) ────────────────────────────────────────

const INSURANCE_PLANS = [
  {
    id: "BASIC",
    name: "Basic",
    premium: 1200,
    maxPayout: 25000,
    events: ["DROUGHT"],
    color: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-800",
    icon: "☀️",
  },
  {
    id: "STANDARD",
    name: "Standard",
    premium: 2800,
    maxPayout: 75000,
    events: ["DROUGHT", "FLOOD", "HEATWAVE"],
    color: "border-blue-200 bg-blue-50",
    badge: "bg-blue-100 text-blue-800",
    icon: "🌦️",
    popular: true,
  },
  {
    id: "PREMIUM",
    name: "Premium",
    premium: 4500,
    maxPayout: 200000,
    events: ["DROUGHT", "FLOOD", "HEATWAVE", "DISEASE"],
    color: "border-green-200 bg-green-50",
    badge: "bg-green-100 text-green-800",
    icon: "🛡️",
  },
];

const EVENT_LABELS: Record<string, string> = {
  DROUGHT: "Drought",
  FLOOD: "Flood",
  HEATWAVE: "Heatwave",
  DISEASE: "Pest/Disease",
};

function InsuranceTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { walletAddress, addFlowReward } = useWallet();
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimForm, setClaimForm] = useState({ type: "DROUGHT", description: "" });
  const [claimResult, setClaimResult] = useState<any>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState({ plan: "STANDARD", acres: "", crop: "" });
  const [purchasingPolicy, setPurchasingPolicy] = useState(false);

  const { data: risk, isLoading: loadingRisk } = useGetInsuranceRisk({ query: { queryKey: getGetInsuranceRiskQueryKey() } });
  const { data: claims, isLoading: loadingClaims } = useGetInsuranceClaims({ query: { queryKey: getGetInsuranceClaimsQueryKey() } });
  const createClaim = useCreateInsuranceClaim();
  const cancelPolicy = useCancelInsurancePolicy();
  const resetDemo = useResetInsuranceDemo();

  const handleCancelPolicy = (policyId: number) => {
    if (!confirm("Cancel this policy? You can purchase a new one afterwards.")) return;
    cancelPolicy.mutate({ id: policyId }, {
      onSuccess: () => {
        toast({ title: "Policy Cancelled", description: "Your policy has been cancelled. You can purchase a new one." });
        refetchPolicies();
        queryClient.invalidateQueries({ queryKey: getGetInsuranceClaimsQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to cancel policy.", variant: "destructive" });
      },
    });
  };

  const handleDemoReset = () => {
    if (!confirm("Reset ALL insurance data? This will delete all policies and claims for a clean demo.")) return;
    resetDemo.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Demo Reset Complete", description: "All policies and claims cleared. Ready for a fresh demo!" });
        refetchPolicies();
        queryClient.invalidateQueries({ queryKey: getGetInsuranceClaimsQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to reset demo data.", variant: "destructive" });
      },
    });
  };

  const { data: policies, isLoading: loadingPolicies, refetch: refetchPolicies } = useQuery<any[]>({
    queryKey: ["insurancePolicies"],
    queryFn: async () => {
      const r = await fetch("/api/insurance/policies");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: weather } = useQuery({
    queryKey: ["weatherOracle"],
    queryFn: async () => {
      const r = await fetch("/api/insurance/weather");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 1000 * 60 * 10, // cache 10 min
  });

  const activePolicy = policies?.find((p: any) => p.status === "active");
  const coveredEvents: string[] = activePolicy
    ? (typeof activePolicy.coveredEvents === "string"
        ? JSON.parse(activePolicy.coveredEvents)
        : activePolicy.coveredEvents)
    : [];

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClaimResult(null);
    createClaim.mutate({ data: { claimType: claimForm.type, description: claimForm.description } }, {
      onSuccess: (data: any) => {
        setClaimResult(data);
        setClaimOpen(false);
        setClaimForm({ type: "DROUGHT", description: "" });
        queryClient.invalidateQueries({ queryKey: getGetInsuranceClaimsQueryKey() });
        if (walletAddress) addFlowReward("Insurance Claim Filed", 50);
        toast({
          title: data.weatherValidated ? `Claim Auto-Approved — Payout: ${formatINR(data.payoutAmount)}` : "Claim Submitted — Pending Review",
          description: data.validationNote?.slice(0, 80) + "...",
        });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || "Failed to submit claim.";
        toast({ title: "Error", description: msg, variant: "destructive" });
      },
    });
  };

  const handlePolicyPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyForm.acres || !policyForm.crop) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    setPurchasingPolicy(true);
    try {
      const r = await fetch("/api/insurance/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: policyForm.plan,
          acresCovered: parseFloat(policyForm.acres),
          cropType: policyForm.crop,
          walletAddress: walletAddress || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: "Purchase failed", description: data.error, variant: "destructive" });
        return;
      }
      refetchPolicies();
      setPolicyOpen(false);
      setPolicyForm({ plan: "STANDARD", acres: "", crop: "" });
      toast({
        title: `${data.plan} Policy Activated!`,
        description: data.ipfsCid ? `Policy stored on IPFS: ${data.ipfsCid.slice(0, 20)}...` : "Policy activated successfully.",
      });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setPurchasingPolicy(false);
    }
  };

  const getRiskColor = (level: string) => {
    if (level === "LOW") return "text-green-600 bg-green-50 border-green-200";
    if (level === "MEDIUM") return "text-yellow-600 bg-yellow-50 border-yellow-200";
    if (level === "HIGH") return "text-red-600 bg-red-50 border-red-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };

  const selectedPlan = INSURANCE_PLANS.find(p => p.id === policyForm.plan) ?? INSURANCE_PLANS[1];

  return (
    <div className="space-y-5">

      {/* ── Oracle Banner ── */}
      {weather && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-sky-800 flex items-center gap-1.5">
            🌐 Live Weather Oracle
            <span className="text-[10px] font-normal text-sky-600">· {weather.source}</span>
          </p>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="bg-white/70 rounded-lg p-1.5">
              <p className="text-[10px] text-muted-foreground">Rain 7d</p>
              <p className="text-sm font-bold text-sky-700">{weather.summary?.totalRainfall7d ?? "—"}mm</p>
            </div>
            <div className="bg-white/70 rounded-lg p-1.5">
              <p className="text-[10px] text-muted-foreground">Avg/day</p>
              <p className="text-sm font-bold text-sky-700">{weather.summary?.avgRainfall7d ?? "—"}mm</p>
            </div>
            <div className="bg-white/70 rounded-lg p-1.5">
              <p className="text-[10px] text-muted-foreground">Peak Temp</p>
              <p className="text-sm font-bold text-orange-600">{weather.summary?.maxTemp7d ?? "—"}°C</p>
            </div>
            <div className="bg-white/70 rounded-lg p-1.5">
              <p className="text-[10px] text-muted-foreground">Heat Days</p>
              <p className="text-sm font-bold text-red-600">{weather.summary?.heatwaveDays ?? "—"}</p>
            </div>
          </div>
          <p className="text-[10px] text-sky-600 text-center">Oracle auto-validates claims · No paperwork needed</p>
        </div>
      )}

      {/* ── Policy Card ── */}
      {loadingPolicies ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : activePolicy ? (
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-transparent">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Policy</p>
                <p className="text-lg font-black text-green-700">{activePolicy.plan} Plan</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Max Payout</p>
                <p className="text-xl font-black text-green-700">{formatINR(activePolicy.maxPayout)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {coveredEvents.map((ev: string) => (
                <span key={ev} className="text-[10px] bg-green-100 text-green-800 rounded-full px-2 py-0.5 font-semibold">
                  ✓ {EVENT_LABELS[ev] ?? ev}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{activePolicy.acresCovered} acres · {activePolicy.cropType}</span>
              <span>Valid till {new Date(activePolicy.endDate).toLocaleDateString("en-IN")}</span>
            </div>
            {activePolicy.ipfsCid && (
              <ProtocolLabsBadge cid={activePolicy.ipfsCid} label="policy" />
            )}
            <div className="pt-1 border-t border-dashed border-green-200">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400 gap-1.5 text-xs"
                disabled={cancelPolicy.isPending}
                onClick={() => handleCancelPolicy(activePolicy.id)}
              >
                <XCircle className="w-3.5 h-3.5" />
                {cancelPolicy.isPending ? "Cancelling…" : "Cancel This Policy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-dashed border-amber-300 bg-amber-50/40">
          <CardContent className="pt-4 pb-4 text-center space-y-3">
            <ShieldCheck className="w-10 h-10 mx-auto text-amber-400" />
            <p className="text-sm font-semibold">No active policy</p>
            <p className="text-xs text-muted-foreground">Get covered before a disaster strikes. Claims are auto-validated by the weather oracle.</p>
            <Button className="w-full" onClick={() => setPolicyOpen(true)}>
              🛡️ Get Covered Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Buy Policy Dialog ── */}
      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buy Crop Insurance</DialogTitle>
            <DialogDescription>Policy stored on IPFS · Claims auto-validated by weather oracle</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePolicyPurchase} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs">Choose Plan</Label>
              <div className="space-y-2">
                {INSURANCE_PLANS.map(plan => (
                  <div key={plan.id}
                    onClick={() => setPolicyForm(f => ({ ...f, plan: plan.id }))}
                    className={`cursor-pointer rounded-xl border-2 p-3 transition-all ${
                      policyForm.plan === plan.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{plan.icon}</span>
                        <div>
                          <p className="text-sm font-bold">{plan.name}</p>
                          <div className="flex gap-1 mt-0.5">
                            {plan.events.map(ev => (
                              <span key={ev} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${plan.badge}`}>{EVENT_LABELS[ev]}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black">₹{plan.premium.toLocaleString()}/yr</p>
                        <p className="text-[10px] text-muted-foreground">up to {formatINR(plan.maxPayout)}</p>
                      </div>
                    </div>
                    {plan.popular && <p className="text-[10px] text-blue-600 font-semibold mt-1">⭐ Most Popular</p>}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Acres to Cover</Label>
                <Input type="number" step="0.1" min="0.1" placeholder="e.g. 2.5" className="h-9 text-sm"
                  value={policyForm.acres} onChange={e => setPolicyForm(f => ({ ...f, acres: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Crop Type</Label>
                <Input placeholder="e.g. Wheat" className="h-9 text-sm"
                  value={policyForm.crop} onChange={e => setPolicyForm(f => ({ ...f, crop: e.target.value }))} required />
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold">Summary</p>
              <div className="flex justify-between"><span>Annual Premium</span><span className="font-bold">₹{selectedPlan.premium.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Max Claim Payout</span><span className="font-bold">{formatINR(selectedPlan.maxPayout)}</span></div>
              <div className="flex justify-between"><span>Covered Events</span><span className="font-bold">{selectedPlan.events.length}</span></div>
              <div className="flex justify-between"><span>Validation</span><span className="font-bold text-sky-700">Weather Oracle (auto)</span></div>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-xs text-blue-700 flex items-start gap-1.5">
              <Database className="w-3 h-3 mt-0.5 shrink-0" />
              <span>Policy document stored permanently on <strong>IPFS</strong> via Lighthouse.</span>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={purchasingPolicy}>
              {purchasingPolicy ? "Uploading to IPFS..." : `⬡ Activate ${selectedPlan.name} Policy`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Risk Assessment ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="w-5 h-5 text-primary" /> Current Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRisk ? (
            <Skeleton className="h-32 w-full" />
          ) : risk ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border flex items-center justify-between ${getRiskColor(risk.riskLevel)}`}>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider opacity-80">Risk Level</p>
                  <p className="text-2xl font-black">{risk.riskLevel}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold uppercase tracking-wider opacity-80">Score</p>
                  <p className="text-2xl font-black">{risk.riskScore}/100</p>
                </div>
              </div>
              {risk.reasons && risk.reasons.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                    <AlertCircle className="w-4 h-4" /> Risk Triggers
                  </p>
                  <ul className="text-sm space-y-1.5">
                    {risk.reasons.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {risk.recommendations && risk.recommendations.length > 0 && (
                <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Recommendations
                  </p>
                  <ul className="text-sm space-y-1.5 text-muted-foreground">
                    {risk.recommendations.map((r: string, i: number) => <li key={i}>• {r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">Risk data unavailable</div>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3 items-stretch">
          {walletAddress && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Filing a claim earns <strong>+50 FLOW</strong>
            </div>
          )}
          {risk?.eligibleForClaim ? (
            <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
              <DialogTrigger asChild>
                <Button className="w-full font-bold relative" size="lg" variant="destructive">
                  File Claim (Eligible)
                  {walletAddress && <span className="absolute right-4 text-[9px] bg-white/20 px-1.5 py-px rounded-full">+50 FLOW</span>}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>File Parametric Claim</DialogTitle>
                  <DialogDescription>
                    Weather oracle will auto-validate your claim against live data.
                    {walletAddress && <span className="text-amber-600 font-semibold"> Filing earns +50 FLOW.</span>}
                  </DialogDescription>
                </DialogHeader>

                {weather && (
                  <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-xs text-sky-800 space-y-1">
                    <p className="font-semibold flex items-center gap-1">🌐 Oracle Data (Auto-Validates Claim)</p>
                    <p>Rain 7d: <strong>{weather.summary?.totalRainfall7d}mm</strong> · Avg: <strong>{weather.summary?.avgRainfall7d}mm/day</strong></p>
                    <p>Peak Temp: <strong>{weather.summary?.maxTemp7d}°C</strong> · Heat Days (≥40°C): <strong>{weather.summary?.heatwaveDays}</strong></p>
                  </div>
                )}

                <form onSubmit={handleClaimSubmit} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Trigger Event</Label>
                    <Select value={claimForm.type} onValueChange={val => setClaimForm({ ...claimForm, type: val })}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {(coveredEvents.length > 0 ? coveredEvents : ["DROUGHT", "FLOOD", "HEATWAVE", "DISEASE"]).map(ev => (
                          <SelectItem key={ev} value={ev}>{EVENT_LABELS[ev] ?? ev}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {coveredEvents.length > 0 && !coveredEvents.includes(claimForm.type) && (
                      <p className="text-xs text-red-500">⚠ Your plan does not cover this event type</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Additional Details</Label>
                    <Textarea placeholder="Describe the impact on your crops..."
                      value={claimForm.description} onChange={e => setClaimForm({ ...claimForm, description: e.target.value })} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={createClaim.isPending}>
                    {createClaim.isPending ? "Validating with oracle..." : "Submit & Auto-Validate"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            !activePolicy && (
              <Button variant="outline" className="w-full" onClick={() => setPolicyOpen(true)}>
                🛡️ Get Covered — Buy a Policy
              </Button>
            )
          )}
        </CardFooter>
      </Card>

      {/* ── Claim Result ── */}
      {claimResult && (
        <Card className={claimResult.weatherValidated ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              {claimResult.weatherValidated
                ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                : <AlertCircle className="w-5 h-5 text-amber-600" />}
              <p className={`font-bold text-sm ${claimResult.weatherValidated ? "text-green-700" : "text-amber-700"}`}>
                {claimResult.weatherValidated ? "Claim Auto-Approved by Oracle" : "Claim Under Review"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{claimResult.validationNote}</p>
            {claimResult.payoutAmount && (
              <div className="bg-white/60 rounded-lg p-2 flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Approved Payout</span>
                <span className="font-black text-green-700 text-lg">{formatINR(claimResult.payoutAmount)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Claims History ── */}
      <div>
        <h3 className="text-base font-bold mb-3 flex items-center gap-2"><FileText className="w-5 h-5" /> Claims History</h3>
        {loadingClaims ? (
          <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
        ) : claims && claims.length > 0 ? (
          <div className="space-y-3">
            {claims.map((claim) => (
              <Card key={claim.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm">{EVENT_LABELS[claim.claimType] ?? claim.claimType} Event</p>
                      <p className="text-xs text-muted-foreground">{new Date(claim.createdAt).toLocaleDateString("en-IN")}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={
                        claim.status === "approved" ? "default"
                        : claim.status === "pending" ? "secondary"
                        : "outline"
                      }>
                        {claim.status === "approved" ? "✓ Approved" : claim.status === "pending" ? "⏳ Pending" : claim.status}
                      </Badge>
                      {claim.weatherValidated && (
                        <span className="text-[9px] text-sky-600 font-semibold bg-sky-50 rounded-full px-1.5 py-0.5">🌐 Oracle Verified</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{claim.description}</p>
                  {claim.validationNote && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">"{claim.validationNote}"</p>
                  )}
                  {claim.payoutAmount && (
                    <div className="bg-green-50 rounded p-2 flex justify-between items-center text-xs font-semibold">
                      <span>Payout</span>
                      <span className="text-green-700 font-black">{formatINR(claim.payoutAmount)}</span>
                    </div>
                  )}
                  {claim.status === "approved" && (
                    <div className="bg-accent/10 text-accent-foreground p-2 rounded text-xs font-semibold flex justify-between items-center">
                      <span>FLOW Reward</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />+{claim.rewardPoints} FLOW</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No insurance claims filed yet.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Demo Reset ── */}
      <Card className="border border-dashed border-orange-300 bg-orange-50/50">
        <CardContent className="p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-orange-700 flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Demo Reset
            </p>
            <p className="text-[11px] text-orange-600 mt-0.5">
              Wipe all policies &amp; claims to demo the full flow from scratch.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-orange-700 border-orange-300 hover:bg-orange-100 gap-1.5 text-xs"
            disabled={resetDemo.isPending}
            onClick={handleDemoReset}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {resetDemo.isPending ? "Resetting…" : "Reset All"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Finance Page ────────────────────────────────────────────────────────

export default function FinanceTrade() {
  const { t } = useTranslation();
  const { data: profile } = useQuery({
    queryKey: ["creditProfile"],
    queryFn: () => getCreditProfile(),
  });

  return (
    <div className="relative -mx-4 -mt-5 min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ background: "linear-gradient(165deg, #ecfeff 0%, #cffafe 28%, #e0f2fe 60%, #f0fdfa 100%)" }}>

      {/* Teal blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-cyan-300/35 blur-3xl" />
        <div className="absolute top-1/4 -left-16 w-60 h-60 rounded-full bg-teal-200/30 blur-3xl" />
        <div className="absolute top-2/3 right-0 w-56 h-56 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-cyan-100/25 blur-2xl" />
      </div>

      <div className="relative space-y-5 px-4 pt-5 pb-28">

        {/* Hero Header */}
        <div className="relative rounded-2xl overflow-hidden p-4 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-teal-500/30 active:translate-y-0"
          style={{ background: "linear-gradient(135deg, #0f766e 0%, #0891b2 45%, #06b6d4 100%)", border: "1px solid rgba(255,255,255,0.35)" }}>
          <div className="absolute -top-4 -right-4 w-36 h-36 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-28 h-16 rounded-full bg-teal-300/20 blur-xl" />
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Landmark className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">{t("finance.title")}</h2>
              </div>
              <p className="text-cyan-100/80 text-xs mt-0.5 font-medium">Credit Score · Loan Offers · Insurance</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
              <span>⬡</span> Protocol Labs
            </div>
          </div>
        </div>

        <Tabs defaultValue="credit" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-5 h-auto p-1 bg-white/50 backdrop-blur-sm border border-white/60">
            <TabsTrigger value="credit" className="py-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-teal-200/60">{t("finance.creditScore")}</TabsTrigger>
            <TabsTrigger value="loans" className="py-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-teal-200/60">{t("finance.loanOffers")}</TabsTrigger>
            <TabsTrigger value="insurance" className="py-1.5 text-xs data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-teal-200/60">{t("finance.insurance")}</TabsTrigger>
          </TabsList>

          <TabsContent value="credit"><CreditTab /></TabsContent>
          <TabsContent value="loans"><LoansTab creditScore={profile?.overallScore ?? 0} /></TabsContent>
          <TabsContent value="insurance"><InsuranceTab /></TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
