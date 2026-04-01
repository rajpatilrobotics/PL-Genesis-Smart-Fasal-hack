import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCreditProfile,
  submitCreditSeason,
  verifyCreditRecord,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  BadgeCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Database,
  Copy,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Sprout,
  Banknote,
  ShieldCheck,
  Link,
} from "lucide-react";

const PRACTICES = [
  "Crop Rotation",
  "Drip Irrigation",
  "Organic Fertilizer",
  "Zero Tillage",
  "Cover Cropping",
  "Integrated Pest Management",
  "Mulching",
  "Rainwater Harvesting",
  "Solar Powered Irrigation",
  "AI-guided Sowing",
];

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

  const color =
    score >= 750 ? "#22c55e" : score >= 650 ? "#3b82f6" : score >= 550 ? "#f59e0b" : "#ef4444";

  const rating =
    score >= 850 ? "Excellent" : score >= 750 ? "Very Good" : score >= 650 ? "Good" : score >= 550 ? "Average" : "Poor";

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="120" viewBox="0 0 180 120">
        <path
          d={`M ${arcX(-210)} ${arcY(-210)} A ${radius} ${radius} 0 1 1 ${arcX(-210 + 240)} ${arcY(-210 + 240)}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {pct > 0 && (
          <path
            d={`M ${arcX(-210)} ${arcY(-210)} A ${radius} ${radius} 0 ${largeArc} 1 ${arcX(endAngle)} ${arcY(endAngle)}`}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="28" fontWeight="bold" fill={color}>
          {score}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" fill="#6b7280">
          {rating}
        </text>
        <text x={cx} y={cx + 28} textAnchor="middle" fontSize="9" fill="#9ca3af">
          300 – 900
        </text>
      </svg>
    </div>
  );
}

function CreditSeasonCard({ season }: { season: any }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const ratingColor =
    season.creditScore >= 750
      ? "bg-green-100 text-green-800"
      : season.creditScore >= 650
      ? "bg-blue-100 text-blue-800"
      : season.creditScore >= 550
      ? "bg-amber-100 text-amber-800"
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
              <p className="text-xs text-foreground leading-relaxed">
                {season.scoreBreakdown?.summary}
              </p>
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
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${((item.value || 0) / item.max) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono w-10 text-right">
                      {(item.value || 0).toFixed(1)}/{item.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {season.practicesFollowed?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">PRACTICES</p>
                <div className="flex flex-wrap gap-1">
                  {season.practicesFollowed.map((p: string) => (
                    <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-muted/60 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 mb-2">
                <Database className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground">FILECOIN RECORD</p>
              </div>
              <p className="text-xs font-mono break-all text-foreground">{season.ipfsCid}</p>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(season.ipfsCid);
                    toast({ title: "CID copied", description: "Share with your bank for verification" });
                  }}
                >
                  <Copy className="w-3 h-3" /> Copy CID
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => window.open(season.ipfsUrl, "_blank")}
                >
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
    season: "",
    cropGrown: "",
    acresPlanted: "",
    yieldKgPerAcre: "",
    soilHealthScore: "",
    weatherChallenges: "",
    inputCostPerAcre: "",
    revenuePerAcre: "",
    loanTaken: "",
    loanRepaid: "",
  });
  const [selectedPractices, setSelectedPractices] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: (data: any) => submitCreditSeason(data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["creditProfile"] });
      toast({
        title: `Credit Score: ${data.creditScore} (${data.creditRating})`,
        description: `Season archived to Filecoin. CID: ${data.ipfsCid.substring(0, 20)}...`,
      });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to submit season", variant: "destructive" });
    },
  });

  const togglePractice = (p: string) => {
    setSelectedPractices((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleSubmit = () => {
    if (!form.season || !form.cropGrown || !form.acresPlanted || !form.yieldKgPerAcre || !form.soilHealthScore) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    mutation.mutate({
      season: form.season,
      cropGrown: form.cropGrown,
      acresPlanted: parseFloat(form.acresPlanted),
      yieldKgPerAcre: parseFloat(form.yieldKgPerAcre),
      soilHealthScore: parseFloat(form.soilHealthScore),
      practicesFollowed: selectedPractices,
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
          <Sprout className="w-4 h-4 text-green-600" />
          Add Season Record
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Season *</Label>
            <Input
              placeholder="e.g. Kharif 2024"
              className="h-9 text-sm"
              value={form.season}
              onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Crop Grown *</Label>
            <Input
              placeholder="e.g. Wheat"
              className="h-9 text-sm"
              value={form.cropGrown}
              onChange={(e) => setForm((f) => ({ ...f, cropGrown: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Acres Planted *</Label>
            <Input
              type="number"
              placeholder="e.g. 2.5"
              className="h-9 text-sm"
              value={form.acresPlanted}
              onChange={(e) => setForm((f) => ({ ...f, acresPlanted: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Yield (kg/acre) *</Label>
            <Input
              type="number"
              placeholder="e.g. 1800"
              className="h-9 text-sm"
              value={form.yieldKgPerAcre}
              onChange={(e) => setForm((f) => ({ ...f, yieldKgPerAcre: e.target.value }))}
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Soil Health Score (0–100) *</Label>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="e.g. 72"
              className="h-9 text-sm"
              value={form.soilHealthScore}
              onChange={(e) => setForm((f) => ({ ...f, soilHealthScore: e.target.value }))}
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Weather Challenges (optional)</Label>
            <Input
              placeholder="e.g. Late monsoon, heatwave in June"
              className="h-9 text-sm"
              value={form.weatherChallenges}
              onChange={(e) => setForm((f) => ({ ...f, weatherChallenges: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Input Cost (₹/acre)</Label>
            <Input
              type="number"
              placeholder="e.g. 8000"
              className="h-9 text-sm"
              value={form.inputCostPerAcre}
              onChange={(e) => setForm((f) => ({ ...f, inputCostPerAcre: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Revenue (₹/acre)</Label>
            <Input
              type="number"
              placeholder="e.g. 22000"
              className="h-9 text-sm"
              value={form.revenuePerAcre}
              onChange={(e) => setForm((f) => ({ ...f, revenuePerAcre: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Loan Taken (₹)</Label>
            <Input
              type="number"
              placeholder="e.g. 50000"
              className="h-9 text-sm"
              value={form.loanTaken}
              onChange={(e) => setForm((f) => ({ ...f, loanTaken: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Loan Repaid (₹)</Label>
            <Input
              type="number"
              placeholder="e.g. 50000"
              className="h-9 text-sm"
              value={form.loanRepaid}
              onChange={(e) => setForm((f) => ({ ...f, loanRepaid: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Sustainable Practices</Label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PRACTICES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePractice(p)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedPractices.includes(p)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Scoring & Archiving..." : "Submit & Get Credit Score"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VerifyCid() {
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
          <ShieldCheck className="w-4 h-4 text-blue-500" />
          Verify a CID (For Banks / Auditors)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Enter any Filecoin CID to independently verify a farmer's season record without trusting a central database.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="bafybeig..."
            className="h-9 text-xs font-mono"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
          />
          <Button
            size="sm"
            className="gap-1"
            onClick={() => {
              if (!cid.trim()) {
                toast({ title: "Enter a CID to verify", variant: "destructive" });
                return;
              }
              setSearched(cid.trim());
            }}
          >
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>
        {isLoading && searched && (
          <p className="text-xs text-muted-foreground animate-pulse">Verifying on-chain record...</p>
        )}
        {isError && searched && (
          <div className="bg-red-50 rounded-lg p-3">
            <p className="text-xs text-red-600 font-medium">No record found for this CID.</p>
            <p className="text-xs text-red-500">This record may not exist or the CID is incorrect.</p>
          </div>
        )}
        {data && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-green-600" />
              <p className="text-xs font-bold text-green-700">Record Verified</p>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span className="text-muted-foreground">Farmer ID</span>
              <span className="font-mono font-medium">{(data as any).farmerId}</span>
              <span className="text-muted-foreground">Season</span>
              <span className="font-medium">{(data as any).season}</span>
              <span className="text-muted-foreground">Crop</span>
              <span className="font-medium">{(data as any).cropGrown}</span>
              <span className="text-muted-foreground">Yield</span>
              <span className="font-medium">{(data as any).yieldKgPerAcre} kg/acre</span>
              <span className="text-muted-foreground">Credit Score</span>
              <span className="font-bold text-green-700">{(data as any).creditScore} · {(data as any).creditRating}</span>
              <span className="text-muted-foreground">Archived</span>
              <span>{new Date((data as any).createdAt).toLocaleDateString("en-IN")}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CreditPage() {
  const [showForm, setShowForm] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["creditProfile"],
    queryFn: () => getCreditProfile(),
  });

  const trendIcon =
    profile?.trend === "Improving" ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : profile?.trend === "Declining" ? (
      <TrendingDown className="w-4 h-4 text-red-500" />
    ) : (
      <Minus className="w-4 h-4 text-muted-foreground" />
    );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Credit History</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Verifiable farming track record — archived on Filecoin for bank audits
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm animate-pulse">
            Loading credit profile...
          </CardContent>
        </Card>
      ) : profile && profile.totalSeasons > 0 ? (
        <Card className="border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-5 pb-4">
            <ScoreArc score={profile.overallScore} />
            <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
              <div>
                <p className="text-muted-foreground">Seasons</p>
                <p className="font-bold text-base">{profile.totalSeasons}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg Yield</p>
                <p className="font-bold text-base">{profile.averageYield} kg/ac</p>
              </div>
              <div>
                <p className="text-muted-foreground">Soil Health</p>
                <p className="font-bold text-base">{profile.averageSoilHealth}/100</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-3">
              {trendIcon}
              <span className="text-xs text-muted-foreground">{profile.trend}</span>
            </div>

            <div className="mt-4 bg-white/60 dark:bg-black/20 rounded-xl p-3 flex items-start gap-2">
              <Banknote className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <p className="text-xs text-foreground leading-relaxed">
                {profile.loanEligibility}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2">
          <CardContent className="py-8 text-center space-y-2">
            <Database className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">No credit history yet</p>
            <p className="text-xs text-muted-foreground">
              Add your first season to start building a verifiable farming track record
            </p>
          </CardContent>
        </Card>
      )}

      {showForm ? (
        <AddSeasonForm onClose={() => setShowForm(false)} />
      ) : (
        <Button className="w-full gap-2" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Add Season Record
        </Button>
      )}

      {profile && profile.seasons && profile.seasons.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Database className="w-4 h-4" />
            Season History ({profile.seasons.length})
          </h2>
          {profile.seasons.map((season: any) => (
            <CreditSeasonCard key={season.id} season={season} />
          ))}
        </div>
      )}

      <VerifyCid />
    </div>
  );
}
