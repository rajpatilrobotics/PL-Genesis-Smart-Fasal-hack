import { useTranslation } from "react-i18next";
import {
  useGetInsuranceRisk, getGetInsuranceRiskQueryKey,
  useGetInsuranceClaims, getGetInsuranceClaimsQueryKey,
  useCreateInsuranceClaim,
  useGetInsurancePolicies, getGetInsurancePoliciesQueryKey,
  useCreateInsurancePolicy,
  useCancelInsurancePolicy,
  useResetInsuranceDemo,
  useGetInsuranceWeather, getGetInsuranceWeatherQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert, ShieldCheck, AlertCircle, FileText, CheckCircle2, Zap,
  CloudRain, Thermometer, Droplets, ExternalLink, Star, TrendingUp,
  Satellite, BadgeCheck, Clock, IndianRupee, Calculator, Leaf,
  XCircle, RotateCcw, Trash2
} from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet-context";

const PLAN_DETAILS = {
  BASIC: {
    label: "Basic",
    color: "border-blue-200 bg-blue-50",
    headerColor: "bg-blue-100 text-blue-800",
    badgeColor: "bg-blue-100 text-blue-700",
    premium: 1200,
    premiumMonthly: 100,
    maxPayout: 25000,
    events: ["DROUGHT"],
    eventLabels: ["Drought"],
    description: "Essential drought protection for small farms",
    icon: "🌾",
  },
  STANDARD: {
    label: "Standard",
    color: "border-green-200 bg-green-50",
    headerColor: "bg-green-100 text-green-800",
    badgeColor: "bg-green-100 text-green-700",
    premium: 2800,
    premiumMonthly: 233,
    maxPayout: 75000,
    events: ["DROUGHT", "FLOOD", "HEATWAVE"],
    eventLabels: ["Drought", "Flood", "Heatwave"],
    description: "Full climate protection for mid-size operations",
    icon: "🌿",
  },
  PREMIUM: {
    label: "Premium",
    color: "border-amber-200 bg-amber-50",
    headerColor: "bg-amber-100 text-amber-800",
    badgeColor: "bg-amber-100 text-amber-700",
    premium: 4500,
    premiumMonthly: 375,
    maxPayout: 200000,
    events: ["DROUGHT", "FLOOD", "HEATWAVE", "DISEASE"],
    eventLabels: ["Drought", "Flood", "Heatwave", "Pest/Disease"],
    description: "Complete coverage including pest & disease outbreaks",
    icon: "🏆",
  },
};

const CROP_OPTIONS = [
  "Wheat", "Rice", "Maize", "Sugarcane", "Cotton",
  "Soybean", "Groundnut", "Sunflower", "Mustard", "Barley"
];

export default function Insurance() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { walletAddress, addFlowReward } = useWallet();

  const [claimOpen, setClaimOpen] = useState(false);
  const [claimForm, setClaimForm] = useState({
    type: "DROUGHT",
    description: "",
    acresCovered: "",
    cropValuePerAcre: "",
  });

  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLAN_DETAILS | null>(null);
  const [purchaseForm, setPurchaseForm] = useState({
    acresCovered: "",
    cropType: "Wheat",
  });

  const { data: risk, isLoading: loadingRisk } = useGetInsuranceRisk({
    query: { queryKey: getGetInsuranceRiskQueryKey() }
  });
  const { data: claims, isLoading: loadingClaims } = useGetInsuranceClaims({
    query: { queryKey: getGetInsuranceClaimsQueryKey() }
  });
  const { data: policies, isLoading: loadingPolicies } = useGetInsurancePolicies({
    query: { queryKey: getGetInsurancePoliciesQueryKey() }
  });
  const { data: weather, isLoading: loadingWeather } = useGetInsuranceWeather({
    query: { queryKey: getGetInsuranceWeatherQueryKey() }
  });

  const createClaim = useCreateInsuranceClaim();
  const createPolicy = useCreateInsurancePolicy();
  const cancelPolicy = useCancelInsurancePolicy();
  const resetDemo = useResetInsuranceDemo();

  const handleCancelPolicy = (policyId: number) => {
    if (!confirm("Cancel this policy? You can purchase a new one afterwards.")) return;
    cancelPolicy.mutate({ id: policyId }, {
      onSuccess: () => {
        toast({ title: "Policy Cancelled", description: "Your policy has been cancelled. You can purchase a new one." });
        queryClient.invalidateQueries({ queryKey: getGetInsurancePoliciesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetInsuranceClaimsQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to cancel policy.", variant: "destructive" });
      }
    });
  };

  const handleDemoReset = () => {
    if (!confirm("Reset ALL insurance data? This will delete all policies and claims for a clean demo.")) return;
    resetDemo.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "🔄 Demo Reset Complete", description: "All policies and claims cleared. Ready for a fresh demo!" });
        queryClient.invalidateQueries({ queryKey: getGetInsurancePoliciesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetInsuranceClaimsQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to reset demo data.", variant: "destructive" });
      }
    });
  };

  const activePolicy = policies?.find((p) => p.status === "active");
  const activePlanDetails = activePolicy ? PLAN_DETAILS[activePolicy.plan as keyof typeof PLAN_DETAILS] : null;

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClaim.mutate({
      data: {
        claimType: claimForm.type,
        description: claimForm.description,
        walletAddress: walletAddress ?? undefined,
        acresCovered: claimForm.acresCovered ? parseFloat(claimForm.acresCovered) : undefined,
        cropValuePerAcre: claimForm.cropValuePerAcre ? parseFloat(claimForm.cropValuePerAcre) : undefined,
      }
    }, {
      onSuccess: (result: any) => {
        const validated = result?.weatherValidated;
        const payout = result?.payoutAmount;
        toast({
          title: validated ? "✅ Claim Auto-Approved!" : "📋 Claim Submitted",
          description: validated
            ? `Oracle validated your claim. Payout: ₹${payout?.toLocaleString("en-IN") ?? "–"}`
            : "Your claim has been queued for manual review.",
        });
        setClaimOpen(false);
        setClaimForm({ type: "DROUGHT", description: "", acresCovered: "", cropValuePerAcre: "" });
        queryClient.invalidateQueries({ queryKey: getGetInsuranceClaimsQueryKey() });
        if (walletAddress) addFlowReward("Insurance Claim Filed", 50);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Failed to submit claim.";
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    });
  };

  const handlePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    createPolicy.mutate({
      data: {
        plan: selectedPlan,
        acresCovered: parseFloat(purchaseForm.acresCovered),
        cropType: purchaseForm.cropType,
        walletAddress: walletAddress ?? undefined,
      }
    }, {
      onSuccess: (result: any) => {
        toast({
          title: "🎉 Policy Activated!",
          description: `Your ${selectedPlan} plan is now active. ${result?.ipfsCid ? "Policy stored on IPFS." : ""}`,
        });
        setPurchaseOpen(false);
        setSelectedPlan(null);
        setPurchaseForm({ acresCovered: "", cropType: "Wheat" });
        queryClient.invalidateQueries({ queryKey: getGetInsurancePoliciesQueryKey() });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error ?? "Failed to purchase policy.";
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    });
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "LOW": return "text-green-700 bg-green-50 border-green-200";
      case "MEDIUM": return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "HIGH": return "text-red-700 bg-red-50 border-red-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getConfidenceColor = (validated: boolean | null | undefined, note: string | null | undefined) => {
    if (!validated) return "bg-yellow-50 border-yellow-200 text-yellow-800";
    if (note?.includes("HIGH") || note?.includes("Automatic")) return "bg-green-50 border-green-200 text-green-800";
    return "bg-blue-50 border-blue-200 text-blue-800";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("insurance.title")}</h2>
        <p className="text-muted-foreground text-sm">
          Auto-triggered payouts via live weather oracle · Policies stored on IPFS
        </p>
        {walletAddress && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Filing a claim earns <strong>+50 FLOW</strong>
          </div>
        )}
      </div>

      {/* ── Weather Oracle Live Panel ──────────────────────────────────── */}
      <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sky-800 text-base">
            <Satellite className="w-4 h-4" />
            Live Weather Oracle
            <Badge variant="outline" className="text-[10px] border-sky-300 text-sky-700 ml-auto">
              Open-Meteo API
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingWeather ? (
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : weather?.summary ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/70 rounded-lg p-3 text-center border border-sky-100">
                  <CloudRain className="w-4 h-4 mx-auto mb-1 text-sky-600" />
                  <p className="text-xl font-black text-sky-800">{weather.summary.totalRainfall7d}mm</p>
                  <p className="text-[10px] text-sky-600 font-medium">Rainfall (7d)</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 text-center border border-sky-100">
                  <Droplets className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                  <p className="text-xl font-black text-blue-800">{weather.summary.avgRainfall7d}mm/day</p>
                  <p className="text-[10px] text-blue-600 font-medium">Avg Daily Rain</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 text-center border border-orange-100">
                  <Thermometer className="w-4 h-4 mx-auto mb-1 text-orange-600" />
                  <p className="text-xl font-black text-orange-800">{weather.summary.maxTemp7d}°C</p>
                  <p className="text-[10px] text-orange-600 font-medium">Peak Temp (7d)</p>
                </div>
                <div className="bg-white/70 rounded-lg p-3 text-center border border-red-100">
                  <AlertCircle className="w-4 h-4 mx-auto mb-1 text-red-600" />
                  <p className="text-xl font-black text-red-800">{weather.summary.heatwaveDays}</p>
                  <p className="text-[10px] text-red-600 font-medium">Heatwave Days</p>
                </div>
              </div>
              <p className="text-[10px] text-sky-500 mt-2 text-center">
                Source: {weather.source} · Last fetched: {new Date(weather.fetchedAt).toLocaleTimeString()}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Weather oracle offline</p>
          )}
        </CardContent>
      </Card>

      {/* ── Active Policy ──────────────────────────────────────────────── */}
      {!loadingPolicies && (
        activePolicy ? (
          <Card className={`border-2 ${activePlanDetails?.color}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{activePlanDetails?.icon}</span>
                    <p className="font-black text-base">{activePlanDetails?.label} Plan</p>
                    <Badge className="text-[10px] bg-green-100 text-green-800 border-green-300">ACTIVE</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {parseFloat(activePolicy.acresCovered).toFixed(1)} acres · {activePolicy.cropType}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Max Payout</p>
                  <p className="font-black text-green-700 text-lg">₹{activePolicy.maxPayout.toLocaleString("en-IN")}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {(() => {
                  let events: string[] = [];
                  try { events = JSON.parse(activePolicy.coveredEvents); } catch { events = []; }
                  return events.map((evt: string) => (
                    <Badge key={evt} variant="outline" className={`text-[10px] ${activePlanDetails?.badgeColor}`}>
                      {evt}
                    </Badge>
                  ));
                })()}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  ₹{Math.round(activePolicy.premiumAnnual / 12).toLocaleString("en-IN")}/month
                </span>
                <span className="text-muted-foreground">
                  Expires: {new Date(activePolicy.endDate).toLocaleDateString("en-IN")}
                </span>
                {activePolicy.ipfsUrl && (
                  <a
                    href={activePolicy.ipfsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 font-medium"
                  >
                    <ExternalLink className="w-3 h-3" /> IPFS Policy
                  </a>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-dashed">
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
          <Card className="border-dashed border-2 border-muted-foreground/30">
            <CardContent className="p-5 text-center">
              <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="font-semibold text-sm mb-1">No Active Policy</p>
              <p className="text-xs text-muted-foreground mb-3">
                Get covered before a disaster strikes. Policies are parametric — payouts triggered automatically by oracle data.
              </p>
              <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Get Covered Now
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Choose Your Coverage Plan</DialogTitle>
                    <DialogDescription>
                      Payouts are automatic — triggered by live weather oracle data, no paperwork needed.
                    </DialogDescription>
                  </DialogHeader>

                  {/* Plan cards */}
                  <div className="space-y-2 pt-2">
                    {(Object.entries(PLAN_DETAILS) as [keyof typeof PLAN_DETAILS, typeof PLAN_DETAILS["BASIC"]][]).map(([key, plan]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedPlan(key)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedPlan === key ? plan.color + " border-current shadow-sm" : "border-muted hover:border-muted-foreground/40 bg-background"}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{plan.icon}</span>
                            <span className="font-bold text-sm">{plan.label}</span>
                            {key === "STANDARD" && (
                              <Badge className="text-[9px] bg-green-600 text-white px-1 py-0">Popular</Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-black text-sm">₹{plan.premiumMonthly.toLocaleString("en-IN")}</span>
                            <span className="text-[10px] text-muted-foreground">/mo</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">{plan.description}</p>
                          <span className="text-[10px] font-semibold text-green-700 ml-2 shrink-0">
                            up to ₹{(plan.maxPayout / 1000).toFixed(0)}k
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {plan.eventLabels.map((e) => (
                            <span key={e} className="text-[9px] bg-white/80 border rounded-full px-1.5 py-0.5">
                              {e}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedPlan && (
                    <form onSubmit={handlePurchase} className="space-y-3 pt-1 border-t">
                      <p className="text-xs font-semibold text-muted-foreground pt-1">Farm Details</p>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Acres Covered</Label>
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          placeholder="e.g. 5"
                          value={purchaseForm.acresCovered}
                          onChange={(e) => setPurchaseForm({ ...purchaseForm, acresCovered: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Primary Crop</Label>
                        <Select value={purchaseForm.cropType} onValueChange={(val) => setPurchaseForm({ ...purchaseForm, cropType: val })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CROP_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {purchaseForm.acresCovered && selectedPlan && (
                        <div className="bg-muted/50 rounded-lg p-2.5 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Annual Premium</span>
                            <span className="font-semibold">₹{PLAN_DETAILS[selectedPlan].premium.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max Payout</span>
                            <span className="font-bold text-green-700">₹{PLAN_DETAILS[selectedPlan].maxPayout.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Coverage per Acre</span>
                            <span className="font-semibold">
                              ₹{Math.round(PLAN_DETAILS[selectedPlan].maxPayout / parseFloat(purchaseForm.acresCovered || "1")).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      )}

                      <Button type="submit" className="w-full" disabled={createPolicy.isPending || !purchaseForm.acresCovered}>
                        {createPolicy.isPending ? "Activating Policy..." : `Activate ${selectedPlan} Plan`}
                      </Button>
                    </form>
                  )}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )
      )}

      {/* ── Risk Assessment ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="w-4 h-4 text-primary" />
            Current Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRisk ? (
            <Skeleton className="h-28 w-full" />
          ) : risk ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border flex items-center justify-between ${getRiskColor(risk.riskLevel)}`}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider opacity-70">Risk Level</p>
                  <p className="text-2xl font-black">{risk.riskLevel}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-70">Score</p>
                  <p className="text-2xl font-black">{risk.riskScore}/100</p>
                </div>
              </div>

              {risk.reasons && risk.reasons.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                    <AlertCircle className="w-3.5 h-3.5" /> Risk Triggers
                  </p>
                  <ul className="text-xs space-y-1.5">
                    {risk.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(risk as any).weatherSummary && (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs">
                  <p className="font-semibold text-sky-800 flex items-center gap-1 mb-1.5">
                    <Satellite className="w-3 h-3" /> Oracle snapshot used for this assessment
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sky-700">
                    <span>7d rainfall: <strong>{(risk as any).weatherSummary.totalRainfall7d}mm</strong></span>
                    <span>Peak temp: <strong>{(risk as any).weatherSummary.maxTemp7d}°C</strong></span>
                    <span>Avg/day: <strong>{(risk as any).weatherSummary.avgRainfall7d}mm</strong></span>
                    <span>Heatwave days: <strong>{(risk as any).weatherSummary.heatwaveDays}</strong></span>
                  </div>
                </div>
              )}

              {risk.recommendations && risk.recommendations.length > 0 && (
                <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Recommendations
                  </p>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {risk.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4 text-sm">Risk data unavailable</div>
          )}
        </CardContent>
        <CardFooter>
          {risk?.eligibleForClaim && (
            <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
              <DialogTrigger asChild>
                <Button className="w-full font-bold relative" size="lg" variant="destructive" data-testid="button-open-claim">
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  File Parametric Claim — Oracle Eligible
                  {walletAddress && (
                    <span className="absolute right-4 text-[9px] bg-white/20 px-1.5 py-px rounded-full">+50 FLOW</span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>File Parametric Insurance Claim</DialogTitle>
                  <DialogDescription>
                    Your farm qualifies for an automated payout. The oracle will validate your claim against live weather data in real-time.
                    {walletAddress && <span className="text-amber-600 font-semibold"> Filing earns +50 FLOW.</span>}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleClaimSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Trigger Event</Label>
                    <Select value={claimForm.type} onValueChange={(val) => setClaimForm({ ...claimForm, type: val })}>
                      <SelectTrigger data-testid="select-claim-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DROUGHT">🌵 Drought / Low Moisture</SelectItem>
                        <SelectItem value="FLOOD">🌊 Excessive Rainfall / Flood</SelectItem>
                        <SelectItem value="HEATWAVE">🔥 Extreme Heat / Heatwave</SelectItem>
                        <SelectItem value="DISEASE">🦠 Pest / Disease Outbreak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1">
                        <Leaf className="w-3 h-3" /> Affected Acres
                      </Label>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        placeholder={activePolicy ? parseFloat(activePolicy.acresCovered).toFixed(1) : "e.g. 5"}
                        value={claimForm.acresCovered}
                        onChange={(e) => setClaimForm({ ...claimForm, acresCovered: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1">
                        <IndianRupee className="w-3 h-3" /> Crop Value/Acre (₹)
                      </Label>
                      <Input
                        type="number"
                        min="100"
                        placeholder="e.g. 15000"
                        value={claimForm.cropValuePerAcre}
                        onChange={(e) => setClaimForm({ ...claimForm, cropValuePerAcre: e.target.value })}
                      />
                    </div>
                  </div>

                  {claimForm.acresCovered && claimForm.cropValuePerAcre && activePolicy && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-800 flex items-center gap-1 mb-2">
                        <Calculator className="w-3 h-3" /> Estimated Payout Range
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                        <div>
                          <p className="text-muted-foreground">Partial (50% damage)</p>
                          <p className="font-black text-base text-green-800">
                            ₹{Math.round(Math.min(
                              parseFloat(claimForm.acresCovered) * parseFloat(claimForm.cropValuePerAcre) * 0.5,
                              activePolicy.maxPayout
                            )).toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Full (80% damage)</p>
                          <p className="font-black text-base text-green-800">
                            ₹{Math.round(Math.min(
                              parseFloat(claimForm.acresCovered) * parseFloat(claimForm.cropValuePerAcre) * 0.8,
                              activePolicy.maxPayout
                            )).toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Capped at policy max: ₹{activePolicy.maxPayout.toLocaleString("en-IN")}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Additional Details</Label>
                    <Textarea
                      placeholder="Describe the impact on your crops..."
                      value={claimForm.description}
                      onChange={(e) => setClaimForm({ ...claimForm, description: e.target.value })}
                      required
                      rows={3}
                    />
                  </div>

                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-2.5 text-xs text-sky-700 flex items-start gap-2">
                    <Satellite className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Oracle will auto-validate against live weather data. High-confidence claims are approved instantly, no paperwork required.</span>
                  </div>

                  <Button type="submit" className="w-full" disabled={createClaim.isPending} data-testid="button-submit-claim">
                    {createClaim.isPending ? "Validating with Oracle..." : "Submit Claim for Oracle Validation"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {!risk?.eligibleForClaim && !loadingRisk && activePolicy && (
            <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full text-sm" size="sm">
                  <FileText className="w-3.5 h-3.5 mr-1.5" /> File Manual Claim
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>File Insurance Claim</DialogTitle>
                  <DialogDescription>
                    Submit a claim for manual oracle review. Drought, flood, and heatwave claims are validated against live weather data.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleClaimSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Trigger Event</Label>
                    <Select value={claimForm.type} onValueChange={(val) => setClaimForm({ ...claimForm, type: val })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DROUGHT">🌵 Drought / Low Moisture</SelectItem>
                        <SelectItem value="FLOOD">🌊 Excessive Rainfall / Flood</SelectItem>
                        <SelectItem value="HEATWAVE">🔥 Extreme Heat / Heatwave</SelectItem>
                        <SelectItem value="DISEASE">🦠 Pest / Disease Outbreak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Additional Details</Label>
                    <Textarea
                      placeholder="Describe the impact..."
                      value={claimForm.description}
                      onChange={(e) => setClaimForm({ ...claimForm, description: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createClaim.isPending}>
                    {createClaim.isPending ? "Submitting..." : "Submit Claim"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardFooter>
      </Card>

      {/* ── Claims History ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-base font-bold mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Claims History
        </h3>
        {loadingClaims ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : claims && claims.length > 0 ? (
          <div className="space-y-3">
            {claims.map((claim) => {
              const weatherParsed = (() => {
                try { return typeof claim.weatherData === "string" ? JSON.parse(claim.weatherData) : claim.weatherData; } catch { return null; }
              })();

              return (
                <Card key={claim.id} className={claim.weatherValidated ? "border-green-200" : ""}>
                  <CardContent className="p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm">{claim.claimType} EVENT</p>
                        <p className="text-xs text-muted-foreground">{new Date(claim.createdAt).toLocaleDateString("en-IN")}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {claim.weatherValidated && (
                          <Badge className="text-[9px] bg-green-100 text-green-800 border-green-300 gap-0.5 px-1.5">
                            <BadgeCheck className="w-3 h-3" /> Oracle Validated
                          </Badge>
                        )}
                        <Badge
                          variant={
                            claim.status?.toUpperCase() === "APPROVED" ? "default" :
                            claim.status?.toUpperCase() === "PENDING" ? "secondary" : "outline"
                          }
                        >
                          {claim.status?.toUpperCase() === "APPROVED" ? (
                            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</span>
                          ) : (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>
                          )}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">{claim.description}</p>

                    {/* Oracle validation note */}
                    {claim.validationNote && (
                      <div className={`text-xs rounded-lg p-2.5 border ${getConfidenceColor(claim.weatherValidated, claim.validationNote)}`}>
                        <p className="flex items-center gap-1 font-semibold mb-0.5">
                          <Satellite className="w-3 h-3" /> Oracle Decision
                        </p>
                        <p className="opacity-90">{claim.validationNote}</p>
                      </div>
                    )}

                    {/* Weather data snapshot */}
                    {weatherParsed && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: "7d Rain", value: `${weatherParsed.totalRainfall7d}mm`, icon: "🌧" },
                          { label: "Avg/day", value: `${weatherParsed.avgRainfall7d}mm`, icon: "💧" },
                          { label: "Peak °C", value: `${weatherParsed.maxTemp7d}°`, icon: "🌡" },
                          { label: "HW Days", value: `${weatherParsed.heatwaveDays}d`, icon: "🔥" },
                        ].map(({ label, value, icon }) => (
                          <div key={label} className="bg-muted/50 rounded-md p-1.5 text-center">
                            <p className="text-base leading-none">{icon}</p>
                            <p className="text-[11px] font-bold mt-0.5">{value}</p>
                            <p className="text-[9px] text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Payout calculator */}
                    {claim.payoutAmount != null && claim.payoutAmount > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Calculator className="w-3.5 h-3.5 text-green-700" />
                            <span className="text-xs font-semibold text-green-800">Approved Payout</span>
                          </div>
                          <span className="text-lg font-black text-green-800">
                            ₹{claim.payoutAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* FLOW reward */}
                    {claim.status?.toUpperCase() === "APPROVED" && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-lg text-xs font-semibold flex justify-between items-center">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" /> FLOW Reward</span>
                        <span>+{claim.rewardPoints} FLOW</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No claims filed yet.</p>
              <p className="text-xs mt-1">File a claim when weather events impact your farm.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Get Covered CTA (when policy exists — upgrade prompt) ─────── */}
      {activePolicy && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-green-800">Want broader coverage?</p>
              <p className="text-xs text-green-700">Upgrade to Premium for pest & disease protection.</p>
            </div>
            <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-green-300 text-green-800 hover:bg-green-100 shrink-0">
                  <Star className="w-3.5 h-3.5 mr-1" /> Upgrade
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Upgrade Your Plan</DialogTitle>
                  <DialogDescription>Select a new plan to activate alongside your farm.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 pt-2">
                  {(Object.entries(PLAN_DETAILS) as [keyof typeof PLAN_DETAILS, typeof PLAN_DETAILS["BASIC"]][]).map(([key, plan]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedPlan(key)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedPlan === key ? plan.color + " border-current shadow-sm" : "border-muted hover:border-muted-foreground/40 bg-background"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span>{plan.icon}</span>
                          <span className="font-bold text-sm">{plan.label}</span>
                        </div>
                        <span className="text-sm font-black">₹{plan.premiumMonthly}/mo</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{plan.description}</p>
                    </button>
                  ))}
                </div>
                {selectedPlan && (
                  <form onSubmit={handlePurchase} className="space-y-3 pt-1 border-t">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Acres Covered</Label>
                      <Input
                        type="number" min="0.1" step="0.1" placeholder="e.g. 5"
                        value={purchaseForm.acresCovered}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, acresCovered: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Primary Crop</Label>
                      <Select value={purchaseForm.cropType} onValueChange={(val) => setPurchaseForm({ ...purchaseForm, cropType: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CROP_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full" disabled={createPolicy.isPending || !purchaseForm.acresCovered}>
                      {createPolicy.isPending ? "Activating..." : `Activate ${selectedPlan} Plan`}
                    </Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* ── Demo Reset ─────────────────────────────────────────────────────── */}
      <Card className="border border-dashed border-orange-300 bg-orange-50/50">
        <CardContent className="p-4 flex items-center justify-between gap-3">
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
            {resetDemo.isPending ? "Resetting…" : "Reset All Data"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
