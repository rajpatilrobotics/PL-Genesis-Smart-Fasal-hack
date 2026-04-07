import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import {
  Card, CardContent, CardHeader, CardTitle, CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Leaf, Droplets, CloudRain, BarChart3, Trophy, ExternalLink,
  Loader2, CheckCircle2, Sparkles, Users, TrendingUp, Globe,
  FlaskConical, TreePine, Flame, Sprout, ShieldCheck, AlertTriangle,
  ArrowRight, Copy, Plus, RefreshCw, Coins, ScrollText,
  Medal, Building2, Award, CalendarDays, Landmark, HandCoins,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImpactClaim {
  id: number;
  farmerName: string;
  farmerAddress: string | null;
  farmLocation: string;
  activity: string;
  description: string;
  cropType: string;
  seasonFrom: string;
  seasonTo: string;
  acresCovered: string;
  fundingGoalInr: number;
  totalFundedInr: number;
  fundersCount: number;
  co2Tonnes: string | null;
  waterSavedLitres: number | null;
  soilHealthScore: number | null;
  impactScore: number | null;
  sensorDataSnapshot: string | null;
  weatherDataSnapshot: string | null;
  status: string;
  hypercertId: string | null;
  hypercertUrl: string | null;
  txHash: string | null;
  ipfsUrl: string | null;
  metadataCid: string | null;
  createdAt: string;
}

interface Funding {
  id: number;
  claimId: number;
  funderName: string;
  funderType: string;
  amountInr: number;
  message: string | null;
  hypercertUrl: string | null;
  txHash: string | null;
  createdAt: string;
}

interface Stats {
  totalClaims: number;
  verifiedClaims: number;
  totalFundings: number;
  totalFundedInr: number;
  totalCO2Tonnes: number;
  totalWaterSavedLitres: number;
  farmerCount: number;
}

interface FunderEntry {
  rank: number;
  funderName: string;
  funderType: string;
  totalAmountInr: number;
  claimsCount: number;
  hypercertsMinted: number;
  totalCO2Funded: number;
  totalWaterFunded: number;
  fundings: Funding[];
}

interface FunderPortalData {
  leaderboard: FunderEntry[];
  typeBreakdown: Record<string, { totalAmountInr: number; count: number }>;
  recentFundings: Funding[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITIES = [
  { value: "Organic Farming", label: "Organic Farming", icon: Sprout, color: "text-green-600 bg-green-50 border-green-200" },
  { value: "Water Conservation", label: "Water Conservation", icon: Droplets, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "Cover Cropping", label: "Cover Cropping", icon: Leaf, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "Reduced Tillage", label: "Reduced Tillage", icon: FlaskConical, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "Agroforestry", label: "Agroforestry", icon: TreePine, color: "text-teal-600 bg-teal-50 border-teal-200" },
  { value: "Zero Residue Burning", label: "Zero Residue Burning", icon: Flame, color: "text-orange-600 bg-orange-50 border-orange-200" },
  { value: "Integrated Pest Management", label: "Integrated Pest Mgmt", icon: ShieldCheck, color: "text-violet-600 bg-violet-50 border-violet-200" },
];

const FUNDER_TYPES = [
  "NGO", "Corporate CSR", "Government Scheme", "Individual Donor", "International Organization",
];

const CROPS = [
  "Wheat", "Rice", "Maize", "Cotton", "Soybean", "Sugarcane", "Mustard",
  "Pulses", "Vegetables", "Fruits", "Millets", "Groundnut",
];

const STATUS_BADGE: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending Verification", className: "bg-yellow-100 text-yellow-700 border-yellow-300", Icon: AlertTriangle },
  verified: { label: "Verified", className: "bg-green-100 text-green-700 border-green-300", Icon: CheckCircle2 },
  funded: { label: "Fully Funded", className: "bg-blue-100 text-blue-700 border-blue-300", Icon: Trophy },
};

function activityMeta(a: string) {
  return ACTIVITIES.find((x) => x.value === a) ?? ACTIVITIES[0];
}

function shortAddr(s: string | null | undefined) {
  if (!s) return "—";
  if (s.startsWith("0x")) return s.slice(0, 6) + "..." + s.slice(-4);
  return s.length > 14 ? s.slice(0, 6) + "..." + s.slice(-6) : s;
}

function fmtINR(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Leaf; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className={cn("rounded-xl border p-3 flex flex-col gap-1", color)}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-70">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-lg font-bold leading-tight">{value}</div>
      {sub && <div className="text-[10px] opacity-60">{sub}</div>}
    </div>
  );
}

// ─── Impact Meter ─────────────────────────────────────────────────────────────

function ImpactMeter({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color = s >= 80 ? "bg-green-500" : s >= 60 ? "bg-emerald-400" : s >= 40 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${s}%` }} />
      </div>
      <span className="text-xs font-bold text-muted-foreground">{s}/100</span>
    </div>
  );
}

// ─── Claim Card ───────────────────────────────────────────────────────────────

function ClaimCard({ claim, onFund }: { claim: ImpactClaim; onFund?: (c: ImpactClaim) => void }) {
  const { label: statusLabel, className: statusCls, Icon: StatusIcon } = STATUS_BADGE[claim.status] ?? STATUS_BADGE.pending;
  const actMeta = activityMeta(claim.activity);
  const ActIcon = actMeta.icon;
  const fundPercent = claim.fundingGoalInr > 0
    ? Math.min(100, Math.round((claim.totalFundedInr / claim.fundingGoalInr) * 100))
    : 0;
  const co2 = parseFloat(claim.co2Tonnes ?? "0");
  const water = claim.waterSavedLitres ?? 0;
  const sensor = !!claim.sensorDataSnapshot;

  return (
    <Card className="border-2 overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg border", actMeta.color)}>
              <ActIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">{claim.farmerName}</div>
              <div className="text-xs text-muted-foreground">{claim.farmLocation}</div>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[10px] shrink-0", statusCls)}>
            <StatusIcon className="w-2.5 h-2.5 mr-1" />
            {statusLabel}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge variant="secondary" className="text-[10px]">{claim.activity}</Badge>
          <Badge variant="secondary" className="text-[10px]">{claim.cropType}</Badge>
          <Badge variant="secondary" className="text-[10px]">{parseFloat(claim.acresCovered).toFixed(1)} ac</Badge>
          {sensor && (
            <Badge className="text-[10px] bg-green-50 text-green-700 border border-green-200">
              <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />IoT Verified
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3 space-y-3">
        <p className="text-xs text-muted-foreground line-clamp-2">{claim.description}</p>

        {/* Impact metrics */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-green-50 border border-green-100 p-2">
            <div className="text-xs font-bold text-green-700">{co2.toFixed(1)}t</div>
            <div className="text-[9px] text-green-600 mt-0.5">CO₂ Offset</div>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-2">
            <div className="text-xs font-bold text-blue-700">
              {water >= 1000 ? (water / 1000).toFixed(0) + "kL" : water + "L"}
            </div>
            <div className="text-[9px] text-blue-600 mt-0.5">Water Saved</div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-2">
            <div className="text-xs font-bold text-amber-700">{claim.soilHealthScore ?? "—"}</div>
            <div className="text-[9px] text-amber-600 mt-0.5">Soil Score</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Impact Score</span>
          </div>
          <ImpactMeter score={claim.impactScore} />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Funding progress</span>
            <span className="font-semibold text-primary">{fundPercent}%</span>
          </div>
          <Progress value={fundPercent} className="h-2" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{fmtINR(claim.totalFundedInr)} raised</span>
            <span>Goal: {fmtINR(claim.fundingGoalInr)}</span>
          </div>
        </div>

        {/* IPFS / Hypercert links */}
        <div className="flex flex-wrap gap-1.5">
          {claim.ipfsUrl && (
            <a href={claim.ipfsUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
              <Globe className="w-3 h-3" />Evidence IPFS
            </a>
          )}
          {claim.hypercertUrl && (
            <a href={claim.hypercertUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-[10px] text-violet-600 hover:underline">
              <Sparkles className="w-3 h-3" />Hypercert
            </a>
          )}
        </div>
      </CardContent>

      {onFund && claim.status !== "funded" && (
        <CardFooter className="px-4 pb-4 pt-0">
          <Button className="w-full h-9 text-sm" onClick={() => onFund(claim)}>
            <Coins className="w-4 h-4 mr-1.5" />
            Fund This Farmer
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// ─── Funding Dialog ───────────────────────────────────────────────────────────

function FundingDialog({
  claim,
  open,
  onClose,
  onSuccess,
}: {
  claim: ImpactClaim | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ funderName: "", funderType: "", amountInr: "", message: "", funderAddress: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    txHash: string | null; hypercertUrl: string; minted: boolean; ipfsUrl: string; message: string;
    fundingInstruction?: string;
  } | null>(null);

  const field = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!claim) return;
    if (!form.funderName || !form.funderType || !form.amountInr) {
      toast({ variant: "destructive", title: "Fill all required fields" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/retroactive/claims/${claim.id}/fund`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funderName: form.funderName,
          funderType: form.funderType,
          amountInr: parseInt(form.amountInr, 10),
          message: form.message || undefined,
          funderAddress: form.funderAddress || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fund");
      setResult(data);
      onSuccess();
    } catch (e) {
      toast({ variant: "destructive", title: "Funding failed", description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setResult(null);
    setForm({ funderName: "", funderType: "", amountInr: "", message: "", funderAddress: "" });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Fund Impact Claim</DialogTitle>
              {claim && (
                <div className="text-xs text-muted-foreground">
                  {claim.farmerName} · {claim.activity} · {claim.farmLocation}
                </div>
              )}
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Your Name / Organisation *</Label>
                <Input placeholder="e.g. NABARD Foundation" value={form.funderName} onChange={(e) => field("funderName")(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Funder Type *</Label>
                <Select value={form.funderType} onValueChange={field("funderType")}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {FUNDER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Funding Amount (INR) *</Label>
                <Input type="number" placeholder="e.g. 5000" value={form.amountInr} onChange={(e) => field("amountInr")(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Message to farmer (optional)</Label>
                <Textarea placeholder="Your message..." value={form.message} onChange={(e) => field("message")(e.target.value)} className="h-16 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Wallet Address (optional — for on-chain credit)</Label>
                <Input placeholder="0x..." value={form.funderAddress} onChange={(e) => field("funderAddress")(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="rounded-lg bg-violet-50 border border-violet-100 p-2 text-[10px] text-violet-700 space-y-1">
                <div className="font-semibold flex items-center gap-1"><Sparkles className="w-3 h-3" />On-chain Hypercert</div>
                <div>Your funding mints a real ERC-1155 Hypercert on Optimism Sepolia encoding the farmer's verified impact data.</div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button size="sm" onClick={submit} disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Coins className="w-3.5 h-3.5 mr-1.5" />}
                {loading ? "Minting…" : "Confirm & Mint"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-base text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                {result.minted ? "Hypercert Minted!" : "Funding Recorded!"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className={cn("rounded-lg p-3 space-y-2 text-xs", result.minted ? "bg-green-50 border border-green-100" : "bg-amber-50 border border-amber-100")}>
                <div className="font-semibold">{result.message}</div>
                {result.fundingInstruction && (
                  <div className="text-[10px] opacity-80">{result.fundingInstruction}</div>
                )}
              </div>

              {result.txHash && (
                <div className="space-y-1">
                  <div className="text-[10px] font-medium text-muted-foreground">Transaction Hash</div>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[10px] bg-muted px-2 py-1 rounded font-mono flex-1 truncate">{result.txHash}</code>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => navigator.clipboard.writeText(result.txHash!)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {result.txHash && (
                  <a href={`https://sepolia-optimism.etherscan.io/tx/${result.txHash}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" />View on Optimism Sepolia Explorer
                  </a>
                )}
                {result.hypercertUrl && (
                  <a href={result.hypercertUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-violet-600 hover:underline">
                    <Sparkles className="w-3.5 h-3.5" />View Hypercert
                  </a>
                )}
                {result.ipfsUrl && (
                  <a href={result.ipfsUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-teal-600 hover:underline">
                    <Globe className="w-3.5 h-3.5" />Impact Certificate on IPFS
                  </a>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" className="w-full" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Submit Claim Form ────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  farmerName: "", farmerAddress: "", farmLocation: "",
  activity: "", description: "", cropType: "",
  seasonFrom: "", seasonTo: "",
  acresCovered: "", fundingGoalInr: "",
};

function SubmitClaimForm({ onSuccess }: { onSuccess: (claim: ImpactClaim) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);

  const field = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    const req = { ...form };
    if (!req.farmerName || !req.farmLocation || !req.activity || !req.cropType ||
      !req.seasonFrom || !req.seasonTo || !req.acresCovered || !req.fundingGoalInr || !req.description) {
      toast({ variant: "destructive", title: "Fill all required fields" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/retroactive/claims"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...req,
          acresCovered: parseFloat(req.acresCovered),
          fundingGoalInr: parseInt(req.fundingGoalInr, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      toast({
        title: "Impact Claim Submitted!",
        description: `Impact score: ${data.impactScore ?? "—"} | CO₂: ${parseFloat(data.co2Tonnes ?? "0").toFixed(1)}t | IPFS: ${data.ipfsReal ? "live" : "local"}`,
      });
      setForm(DEFAULT_FORM);
      onSuccess(data as ImpactClaim);
    } catch (e) {
      toast({ variant: "destructive", title: "Submit failed", description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  const actMeta = form.activity ? activityMeta(form.activity) : null;

  return (
    <Card className="border-2 border-dashed border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          Submit New Impact Claim
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Real sensor &amp; weather data will be auto-attached to your claim as verifiable evidence.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Farmer Name *</Label>
            <Input placeholder="Your full name" value={form.farmerName} onChange={(e) => field("farmerName")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Farm Location *</Label>
            <Input placeholder="Village, District" value={form.farmLocation} onChange={(e) => field("farmLocation")(e.target.value)} />
          </div>
        </div>

        {/* Activity */}
        <div className="space-y-1">
          <Label className="text-xs">Sustainable Activity *</Label>
          <Select value={form.activity} onValueChange={field("activity")}>
            <SelectTrigger>
              <SelectValue placeholder="Select activity type" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITIES.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  <span className="flex items-center gap-2"><a.icon className="w-3.5 h-3.5" />{a.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {actMeta && (
            <div className={cn("rounded-md border px-2 py-1 text-[10px]", actMeta.color)}>
              <actMeta.icon className="inline w-3 h-3 mr-1" />
              Selecting <strong>{actMeta.value}</strong> — impact metrics calculated automatically from real sensor data.
            </div>
          )}
        </div>

        {/* Crop + Season */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Crop *</Label>
            <Select value={form.cropType} onValueChange={field("cropType")}>
              <SelectTrigger><SelectValue placeholder="Crop" /></SelectTrigger>
              <SelectContent>{CROPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Season From *</Label>
            <Input type="date" value={form.seasonFrom} onChange={(e) => field("seasonFrom")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Season To *</Label>
            <Input type="date" value={form.seasonTo} onChange={(e) => field("seasonTo")(e.target.value)} />
          </div>
        </div>

        {/* Acres + Goal */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Acres Covered *</Label>
            <Input type="number" step="0.1" placeholder="e.g. 2.5" value={form.acresCovered} onChange={(e) => field("acresCovered")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Funding Goal (₹) *</Label>
            <Input type="number" placeholder="e.g. 15000" value={form.fundingGoalInr} onChange={(e) => field("fundingGoalInr")(e.target.value)} />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label className="text-xs">Impact Description *</Label>
          <Textarea
            placeholder="Describe your sustainable farming practice and its impact on your community..."
            value={form.description}
            onChange={(e) => field("description")(e.target.value)}
            className="h-16 text-xs"
          />
        </div>

        {/* Wallet */}
        <div className="space-y-1">
          <Label className="text-xs">Wallet Address (optional — to receive Hypercert)</Label>
          <Input placeholder="0x..." value={form.farmerAddress} onChange={(e) => field("farmerAddress")(e.target.value)} className="font-mono text-xs" />
        </div>

        <div className="rounded-lg bg-muted/50 border p-2 text-[10px] text-muted-foreground space-y-1">
          <div className="font-semibold flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Auto-verified on submission</div>
          <div>Real NPK/pH/moisture sensor data + live weather (Open-Meteo) are automatically fetched and attached as tamper-proof IPFS evidence. CO₂ offsets and water savings are calculated using IPCC &amp; FAO guidelines.</div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button className="w-full" onClick={submit} disabled={loading}>
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying &amp; Uploading to IPFS…</>
          ) : (
            <><ScrollText className="w-4 h-4 mr-2" />Submit Impact Claim</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ─── Funder Type Icon ─────────────────────────────────────────────────────────

function funderTypeIcon(type: string) {
  if (type.includes("NGO")) return <Landmark className="w-3.5 h-3.5" />;
  if (type.includes("Corporate")) return <Building2 className="w-3.5 h-3.5" />;
  if (type.includes("Government")) return <Award className="w-3.5 h-3.5" />;
  if (type.includes("International")) return <Globe className="w-3.5 h-3.5" />;
  return <Users className="w-3.5 h-3.5" />;
}

const RANK_COLORS = [
  "bg-amber-100 text-amber-700 border-amber-300",
  "bg-slate-100 text-slate-700 border-slate-300",
  "bg-orange-100 text-orange-700 border-orange-300",
];

// ─── Funder Portal ────────────────────────────────────────────────────────────

function FunderPortal({ onOpenFundDialog }: { onOpenFundDialog: () => void }) {
  const { toast } = useToast();
  const [data, setData] = useState<FunderPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchFunders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/retroactive/funders"));
      const json = await res.json();
      setData(json);
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to load funder data", description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchFunders(); }, [fetchFunders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading funder portal…</span>
      </div>
    );
  }

  if (!data || data.leaderboard.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <Trophy className="w-12 h-12 opacity-20" />
          <div className="text-sm font-medium">No funders yet — be the first</div>
          <div className="text-xs text-center max-w-xs text-muted-foreground">
            NGOs, corporate CSR, and government schemes can retroactively fund verified farmer impact and receive on-chain Hypercerts as proof.
          </div>
          <Button className="mt-1 gap-2" onClick={onOpenFundDialog}>
            <HandCoins className="w-4 h-4" />Fund a Farmer Now
          </Button>
        </div>

        {/* How RPGF works for funders */}
        <Card className="bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-100">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="text-xs font-bold text-violet-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />Why Fund Retroactively?
            </div>
            {[
              ["Zero speculation risk", "You only pay for impact that has already happened and been verified by IoT sensors + AI"],
              ["On-chain proof", "Every contribution mints a real ERC-1155 Hypercert on Optimism Sepolia with your name encoded"],
              ["CSR compliance", "IPFS-stored evidence package satisfies audit requirements for NGO grants and corporate CSR reporting"],
              ["Carbon credits", "CO₂ tonnes are calculated using IPCC Tier 1 methodology — defensible for carbon offset claims"],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-semibold text-violet-800">{title}</div>
                  <div className="text-[10px] text-violet-700 opacity-80">{desc}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalFunded = data.leaderboard.reduce((s, f) => s + f.totalAmountInr, 0);
  const totalCerts = data.leaderboard.reduce((s, f) => s + f.hypercertsMinted, 0);
  const totalCO2 = data.leaderboard.reduce((s, f) => s + f.totalCO2Funded, 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-violet-50 border-violet-100 p-2.5 text-center">
          <div className="text-sm font-bold text-violet-800">{data.leaderboard.length}</div>
          <div className="text-[10px] text-violet-600 mt-0.5">Funders</div>
        </div>
        <div className="rounded-xl border bg-amber-50 border-amber-100 p-2.5 text-center">
          <div className="text-sm font-bold text-amber-800">{fmtINR(totalFunded)}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Total Funded</div>
        </div>
        <div className="rounded-xl border bg-green-50 border-green-100 p-2.5 text-center">
          <div className="text-sm font-bold text-green-800">{totalCO2.toFixed(1)}t</div>
          <div className="text-[10px] text-green-600 mt-0.5">CO₂ Funded</div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />Impact Funder Leaderboard
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={fetchFunders}>
            <RefreshCw className="w-3 h-3" />Refresh
          </Button>
        </div>

        {data.leaderboard.map((funder) => {
          const isExpanded = expanded === funder.funderName;
          const rankColor = RANK_COLORS[funder.rank - 1] ?? "bg-muted/50 text-muted-foreground border-border";
          const pct = totalFunded > 0 ? Math.round((funder.totalAmountInr / totalFunded) * 100) : 0;

          return (
            <Card key={funder.funderName} className={cn("border overflow-hidden transition-all", isExpanded && "border-primary/40")}>
              <button
                className="w-full text-left"
                onClick={() => setExpanded(isExpanded ? null : funder.funderName)}
              >
                <CardContent className="px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    {/* Rank badge */}
                    <div className={cn("shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold", rankColor)}>
                      {funder.rank <= 3 ? <Medal className="w-3.5 h-3.5" /> : `#${funder.rank}`}
                    </div>

                    {/* Name + type */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate">{funder.funderName}</span>
                        {funder.rank === 1 && <Badge className="text-[9px] bg-amber-100 text-amber-700 border border-amber-300 px-1 py-0">Top Funder</Badge>}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        {funderTypeIcon(funder.funderType)}
                        <span>{funder.funderType}</span>
                        <span>·</span>
                        <Sparkles className="w-2.5 h-2.5 text-violet-500" />
                        <span>{funder.hypercertsMinted} Hypercert{funder.hypercertsMinted !== 1 ? "s" : ""}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-primary">{fmtINR(funder.totalAmountInr)}</div>
                      <div className="text-[10px] text-muted-foreground">{funder.claimsCount} claim{funder.claimsCount !== 1 ? "s" : ""}</div>
                    </div>
                  </div>

                  {/* Share bar */}
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>{pct}% of total funding</span>
                      <span>{funder.totalCO2Funded.toFixed(1)}t CO₂ · {funder.totalWaterFunded >= 1000 ? `${Math.round(funder.totalWaterFunded / 1000)}kL` : `${funder.totalWaterFunded}L`} water</span>
                    </div>
                  </div>
                </CardContent>
              </button>

              {/* Expanded fundings */}
              {isExpanded && (
                <div className="border-t bg-muted/30 px-3 py-3 space-y-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Funding History</div>
                  {funder.fundings.map((f) => (
                    <div key={f.id} className="rounded-lg border bg-background px-3 py-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{fmtINR(f.amountInr)}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(f.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {f.message && (
                        <p className="text-[10px] text-muted-foreground italic">"{f.message}"</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {f.txHash && (
                          <a href={`https://sepolia-optimism.etherscan.io/tx/${f.txHash}`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                            <ExternalLink className="w-2.5 h-2.5" />Etherscan
                          </a>
                        )}
                        {f.hypercertUrl && (
                          <a href={f.hypercertUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-[10px] text-violet-600 hover:underline">
                            <Sparkles className="w-2.5 h-2.5" />Hypercert
                          </a>
                        )}
                        {f.txHash && (
                          <button onClick={() => { navigator.clipboard.writeText(f.txHash!); toast({ title: "Copied!" }); }}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                            <Copy className="w-2.5 h-2.5" />{f.txHash.slice(0, 8)}…
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Impact summary for this funder */}
                  <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 mt-1">
                    <div className="text-[10px] font-semibold text-green-700 mb-1.5">Your Verified Impact Attribution</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-xs font-bold text-green-700">{funder.totalCO2Funded.toFixed(1)}t</div>
                        <div className="text-[9px] text-green-600">CO₂ Offset</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-blue-700">
                          {funder.totalWaterFunded >= 1000 ? `${Math.round(funder.totalWaterFunded / 1000)}kL` : `${funder.totalWaterFunded}L`}
                        </div>
                        <div className="text-[9px] text-blue-600">Water Saved</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-violet-700">{funder.hypercertsMinted}</div>
                        <div className="text-[9px] text-violet-600">On-chain Certs</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Funder type breakdown */}
      {Object.keys(data.typeBreakdown).length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />Funding by Source Type
          </div>
          <Card>
            <CardContent className="px-3 py-3 space-y-2.5">
              {Object.entries(data.typeBreakdown)
                .sort((a, b) => b[1].totalAmountInr - a[1].totalAmountInr)
                .map(([type, info]) => {
                  const pct = totalFunded > 0 ? Math.round((info.totalAmountInr / totalFunded) * 100) : 0;
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          {funderTypeIcon(type)}{type}
                        </span>
                        <span className="text-muted-foreground">{fmtINR(info.totalAmountInr)} · {info.count} funding{info.count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent activity feed */}
      {data.recentFundings.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />Recent Funding Activity
          </div>
          <div className="space-y-1.5">
            {data.recentFundings.slice(0, 5).map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 rounded-lg border bg-muted/20 px-3 py-2">
                <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <HandCoins className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{f.funderName}</div>
                  <div className="text-[10px] text-muted-foreground">{f.funderType}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-primary">{fmtINR(f.amountInr)}</div>
                  {f.txHash ? (
                    <div className="flex items-center gap-0.5 text-[10px] text-violet-600">
                      <Sparkles className="w-2.5 h-2.5" />On-chain
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground">Recorded</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <Card className="bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-100">
        <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-violet-800">Fund the next farmer</div>
            <div className="text-[10px] text-violet-600 mt-0.5">
              Your name gets encoded in the Hypercert on Optimism Sepolia
            </div>
          </div>
          <Button size="sm" className="shrink-0 gap-1.5 bg-violet-700 hover:bg-violet-800" onClick={onOpenFundDialog}>
            <HandCoins className="w-3.5 h-3.5" />Fund Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Retroactive() {
  const [claims, setClaims] = useState<ImpactClaim[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"farmer" | "funder" | "portal">("funder");
  const [fundTarget, setFundTarget] = useState<ImpactClaim | null>(null);
  const [activityFilter, setActivityFilter] = useState("all");
  const { toast } = useToast();

  const handleOpenFundDialog = useCallback(() => {
    setRole("funder");
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [claimsRes, statsRes] = await Promise.all([
        fetch(apiUrl("/api/retroactive/claims")),
        fetch(apiUrl("/api/retroactive/stats")),
      ]);
      const [claimsData, statsData] = await Promise.all([claimsRes.json(), statsRes.json()]);
      setClaims(Array.isArray(claimsData) ? claimsData : []);
      setStats(statsData);
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to load data", description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredClaims = activityFilter === "all"
    ? claims
    : claims.filter((c) => c.activity === activityFilter);

  const sortedFunderClaims = [...filteredClaims].sort((a, b) => (b.impactScore ?? 0) - (a.impactScore ?? 0));

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="text-center space-y-1 pt-1">
        <div className="flex items-center justify-center gap-2">
          <div className="p-2 rounded-xl bg-green-100 border border-green-200">
            <Leaf className="w-5 h-5 text-green-700" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Retroactive PGF</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Farmers prove verified environmental impact · Funders mint Hypercerts on Optimism Sepolia
        </p>
        <a
          href="https://hypercerts.org"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-violet-600 hover:underline"
        >
          <Sparkles className="w-3 h-3" />Powered by Hypercerts Protocol
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={Leaf} label="CO₂ Offset" value={`${stats.totalCO2Tonnes.toFixed(1)}t`}
            sub="IPCC-verified tonnes" color="bg-green-50 border-green-200 text-green-800" />
          <StatCard icon={Droplets} label="Water Saved" value={
            stats.totalWaterSavedLitres >= 1000000
              ? `${(stats.totalWaterSavedLitres / 1000000).toFixed(1)}ML`
              : `${Math.round(stats.totalWaterSavedLitres / 1000)}kL`
          } sub="FAO methodology" color="bg-blue-50 border-blue-200 text-blue-800" />
          <StatCard icon={Coins} label="Total Funded" value={fmtINR(stats.totalFundedInr)}
            sub={`${stats.totalFundings} funding(s)`} color="bg-amber-50 border-amber-200 text-amber-800" />
          <StatCard icon={Users} label="Farmers" value={String(stats.farmerCount)}
            sub={`${stats.verifiedClaims} verified claims`} color="bg-violet-50 border-violet-200 text-violet-800" />
        </div>
      )}

      {/* Role switcher */}
      <Tabs value={role} onValueChange={(v) => setRole(v as "farmer" | "funder" | "portal")}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="funder" className="gap-1 text-xs">
            <TrendingUp className="w-3 h-3" />Browse &amp; Fund
          </TabsTrigger>
          <TabsTrigger value="portal" className="gap-1 text-xs">
            <Trophy className="w-3 h-3" />Funder Portal
          </TabsTrigger>
          <TabsTrigger value="farmer" className="gap-1 text-xs">
            <Sprout className="w-3 h-3" />Submit Claim
          </TabsTrigger>
        </TabsList>

        {/* ─── FUNDER TAB ─── */}
        <TabsContent value="funder" className="space-y-3 mt-3">
          {/* Activity filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActivityFilter("all")}
              className={cn(
                "shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-colors",
                activityFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"
              )}
            >
              All
            </button>
            {ACTIVITIES.map((a) => (
              <button
                key={a.value}
                onClick={() => setActivityFilter(a.value)}
                className={cn(
                  "shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1",
                  activityFilter === a.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"
                )}
              >
                <a.icon className="w-3 h-3" />{a.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading claims…</span>
            </div>
          ) : sortedFunderClaims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <BarChart3 className="w-12 h-12 opacity-20" />
              <div className="text-sm font-medium">No impact claims yet</div>
              <div className="text-xs text-center max-w-xs">
                Be the first to submit a verified claim. Switch to the "Submit Claim" tab.
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {sortedFunderClaims.length} claim{sortedFunderClaims.length !== 1 ? "s" : ""} · sorted by impact score
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={fetchData}>
                  <RefreshCw className="w-3 h-3" />Refresh
                </Button>
              </div>
              <div className="space-y-3">
                {sortedFunderClaims.map((c) => (
                  <ClaimCard key={c.id} claim={c} onFund={setFundTarget} />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ─── FUNDER PORTAL TAB ─── */}
        <TabsContent value="portal" className="space-y-3 mt-3">
          <FunderPortal onOpenFundDialog={handleOpenFundDialog} />
        </TabsContent>

        {/* ─── FARMER TAB ─── */}
        <TabsContent value="farmer" className="space-y-4 mt-3">
          <SubmitClaimForm onSuccess={(newClaim) => {
            setClaims((prev) => [newClaim, ...prev]);
            fetchData();
          }} />

          <Separator />

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5" />All Submitted Claims
            </div>
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Loading…</span>
              </div>
            ) : claims.length === 0 ? (
              <div className="text-sm text-center text-muted-foreground py-8">
                No claims submitted yet. Fill the form above to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {claims.map((c) => (
                  <ClaimCard key={c.id} claim={c} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* How it works */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
        <CardContent className="pt-4 pb-4">
          <div className="text-xs font-bold text-green-800 mb-2 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />How Retroactive PGF Works
          </div>
          <div className="space-y-2">
            {[
              ["1", "Farmer submits an impact claim", "Real IoT sensor data (NPK, pH, moisture) + live weather are auto-attached as IPFS evidence"],
              ["2", "Smart Fasal verifies the claim", "CO₂ offsets, water savings, and soil health computed via IPCC + FAO formulas"],
              ["3", "Funders browse &amp; fund claims", "NGOs, CSR teams, governments, or individuals fund verified impact"],
              ["4", "Hypercert minted on-chain", "An ERC-1155 Hypercert is minted on Optimism Sepolia encoding all verified impact data"],
            ].map(([n, title, desc]) => (
              <div key={n} className="flex gap-2.5">
                <div className="shrink-0 w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">{n}</div>
                <div>
                  <div className="text-[11px] font-semibold text-green-800" dangerouslySetInnerHTML={{ __html: title }} />
                  <div className="text-[10px] text-green-700 opacity-80">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Funding dialog */}
      <FundingDialog
        claim={fundTarget}
        open={!!fundTarget}
        onClose={() => setFundTarget(null)}
        onSuccess={fetchData}
      />
    </div>
  );
}
