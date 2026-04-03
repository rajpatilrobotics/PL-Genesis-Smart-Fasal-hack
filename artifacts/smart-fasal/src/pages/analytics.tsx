import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetSensorHistory, getGetSensorHistoryQueryKey,
  useGetAnalyticsSummary, getGetAnalyticsSummaryQueryKey,
  useGetAnalyticsLogs, getGetAnalyticsLogsQueryKey,
  useHealthCheck, getHealthCheckQueryKey,
  useStoreOnFilecoin,
} from "@workspace/api-client-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";
import {
  Activity, Droplets, FlaskConical, TrendingUp, CheckCircle,
  Brain, Sprout, Loader2, Database, Coins, ShoppingCart,
  BadgeCheck, ChevronRight, Zap, BarChart3, Clock, Droplets as Drop,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type CropRec = {
  name: string;
  emoji: string;
  confidence: number;
  season: string;
  expectedYield: string;
  waterRequirement: string;
  growthDays: number;
  reasoning: string;
};

type CropPredictResult = {
  crops: CropRec[];
  insight: string;
};

type DataSale = {
  id: string;
  buyer: string;
  buyerType: "Research" | "Government" | "AgriTech";
  amount: number;
  flowTxId: string;
  soldAt: string;
  records: number;
};

type MyListing = {
  id: string;
  title: string;
  cid: string;
  priceFlow: number;
  records: number;
  listedAt: string;
  sales: DataSale[];
};

// ─── Simulated buyers ────────────────────────────────────────────────────────

const BUYERS = [
  { name: "ICAR New Delhi", type: "Research" as const, icon: "🏛️" },
  { name: "Ministry of Agriculture", type: "Government" as const, icon: "🇮🇳" },
  { name: "AgriTech India Ltd", type: "AgriTech" as const, icon: "🏢" },
  { name: "ICRISAT Hyderabad", type: "Research" as const, icon: "🔬" },
  { name: "Punjab Agri Dept", type: "Government" as const, icon: "🌾" },
  { name: "Ninjacart Analytics", type: "AgriTech" as const, icon: "📊" },
];

function randomHex(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function shortCid(cid: string) {
  return cid.slice(0, 10) + "..." + cid.slice(-6);
}

// ─── Crop AI Tab ─────────────────────────────────────────────────────────────

function CropAITab({ history }: { history: { nitrogen: number; phosphorus: number; potassium: number; ph: number; moisture: number }[] | undefined }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CropPredictResult | null>(null);

  const hasData = history && history.length > 0;

  const avg = (key: "nitrogen" | "phosphorus" | "potassium" | "ph" | "moisture") =>
    hasData ? history!.reduce((s, r) => s + r[key], 0) / history!.length : 0;

  const runPrediction = async () => {
    if (!hasData) {
      toast({ title: "No sensor data yet", description: "Trigger the LIVE sensor on the Home page first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/crop-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avgNitrogen: avg("nitrogen"),
          avgPhosphorus: avg("phosphorus"),
          avgPotassium: avg("potassium"),
          avgPh: avg("ph"),
          avgMoisture: avg("moisture"),
          readingCount: history!.length,
          location: "Punjab, India",
        }),
      });
      if (!res.ok) throw new Error("Prediction failed");
      const data: CropPredictResult = await res.json();
      setResult(data);
    } catch {
      toast({ title: "AI Error", description: "Could not get crop prediction. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const badgeColor: Record<string, string> = {
    "Research": "bg-blue-50 text-blue-700 border-blue-200",
    "Government": "bg-green-50 text-green-700 border-green-200",
    "AgriTech": "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">AI Crop Prediction</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Trained on {hasData ? history!.length : 0} IoT sensor readings from your farm's ESP32-FARM-001 device.
                AI analyses N, P, K, pH & moisture to find the best crops for your soil.
              </p>
            </div>
          </div>

          {hasData && (
            <div className="grid grid-cols-5 gap-1.5 mt-3">
              {[
                { label: "N", value: avg("nitrogen").toFixed(0), unit: "mg/kg", color: "text-green-700 bg-green-100" },
                { label: "P", value: avg("phosphorus").toFixed(0), unit: "mg/kg", color: "text-orange-700 bg-orange-100" },
                { label: "K", value: avg("potassium").toFixed(0), unit: "mg/kg", color: "text-purple-700 bg-purple-100" },
                { label: "pH", value: avg("ph").toFixed(1), unit: "", color: "text-blue-700 bg-blue-100" },
                { label: "H₂O", value: avg("moisture").toFixed(0), unit: "%", color: "text-cyan-700 bg-cyan-100" },
              ].map(({ label, value, unit, color }) => (
                <div key={label} className={cn("rounded-lg p-2 text-center", color)}>
                  <p className="text-[10px] font-semibold">{label}</p>
                  <p className="text-sm font-bold leading-none mt-0.5">{value}<span className="text-[9px] font-normal">{unit}</span></p>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={runPrediction}
            disabled={loading || !hasData}
            className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white"
            size="sm"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Analysing soil profile...</>
            ) : (
              <><Sprout className="w-3.5 h-3.5 mr-1.5" />Predict Best Crops</>
            )}
          </Button>
          {!hasData && (
            <p className="text-[10px] text-center text-muted-foreground mt-1.5">Go to Home → hover LIVE button to generate sensor data first</p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Insight */}
          <Card className="border-amber-100 bg-amber-50/50">
            <CardContent className="p-3">
              <p className="text-[11px] text-amber-900 leading-relaxed">{result.insight}</p>
            </CardContent>
          </Card>

          {/* Crop cards */}
          <div className="space-y-3">
            {result.crops.map((crop, idx) => (
              <Card key={crop.name} className={cn("border", idx === 0 ? "border-emerald-200 bg-emerald-50/30" : "")}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{crop.emoji}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold">{crop.name}</p>
                          {idx === 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white">TOP PICK</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{crop.season}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-700">{crop.confidence}%</p>
                      <p className="text-[10px] text-muted-foreground">confidence</p>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className={cn("h-full rounded-full transition-all duration-1000", idx === 0 ? "bg-emerald-500" : "bg-primary/70")}
                      style={{ width: `${crop.confidence}%` }}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="text-center bg-muted/50 rounded p-1.5">
                      <p className="text-[9px] text-muted-foreground">Yield</p>
                      <p className="text-[11px] font-semibold">{crop.expectedYield}</p>
                    </div>
                    <div className="text-center bg-muted/50 rounded p-1.5">
                      <p className="text-[9px] text-muted-foreground">Water</p>
                      <p className="text-[11px] font-semibold">{crop.waterRequirement}</p>
                    </div>
                    <div className="text-center bg-muted/50 rounded p-1.5">
                      <p className="text-[9px] text-muted-foreground">Duration</p>
                      <p className="text-[11px] font-semibold">{crop.growthDays}d</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">{crop.reasoning}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Data Marketplace Tab ─────────────────────────────────────────────────────

function DataMarketTab({ history }: { history: { nitrogen: number; phosphorus: number; potassium: number; ph: number; moisture: number; createdAt: Date }[] | undefined }) {
  const { toast } = useToast();
  const { addFlowReward, walletAddress, publishDataListing } = useWallet();
  const storeOnFilecoin = useStoreOnFilecoin();
  const [listing, setListing] = useState<boolean>(false);
  const [myListings, setMyListings] = useState<MyListing[]>([]);
  const [pendingSale, setPendingSale] = useState<string | null>(null);

  const hasData = history && history.length > 0;
  const recordCount = history?.length ?? 0;

  const handleListData = async () => {
    if (!hasData) {
      toast({ title: "No data to list", description: "Generate sensor readings first from the Home page.", variant: "destructive" });
      return;
    }
    setListing(true);
    try {
      // Upload to Filecoin/IPFS
      const payload = {
        device: "ESP32-FARM-001",
        location: "Punjab, India",
        records: recordCount,
        readings: history!.slice(0, 5),
        platform: "SmartFasal",
        timestamp: new Date().toISOString(),
      };

      let cid = "bafy" + Array.from({ length: 44 }, () => "abcdefghijklmnopqrstuvwxyz234567"[Math.floor(Math.random() * 32)]).join("");

      await new Promise<void>((resolve) => {
        storeOnFilecoin.mutate(
          { data: { dataType: "sensor_dataset", data: payload as Record<string, unknown> } },
          {
            onSuccess: (d: any) => { if (d?.cid) cid = d.cid; resolve(); },
            onError: () => resolve(),
          }
        );
      });

      const newListing: MyListing = {
        id: randomHex(8),
        title: `Farm Soil Dataset — ${new Date().toLocaleDateString("en-IN")}`,
        cid,
        priceFlow: Math.floor(recordCount * 0.5 + 10),
        records: recordCount,
        listedAt: new Date().toISOString(),
        sales: [],
      };

      setMyListings(prev => [newListing, ...prev]);
      publishDataListing({ id: newListing.id, cid, title: newListing.title, priceFlow: newListing.priceFlow, sold: false, earnings: 0, category: "Soil", records: recordCount });
      addFlowReward("Data Listed on Flow Marketplace", 15);

      toast({
        title: "Listed on Flow Marketplace!",
        description: `CID: ${cid.slice(0, 14)}... · +15 FLOW points earned`,
      });

      // Simulate a buyer appearing after 4–8 seconds
      const delay = 4000 + Math.random() * 4000;
      const buyer = BUYERS[Math.floor(Math.random() * BUYERS.length)];
      setPendingSale(newListing.id);
      setTimeout(() => {
        const sale: DataSale = {
          id: randomHex(8),
          buyer: buyer.name,
          buyerType: buyer.type,
          amount: newListing.priceFlow,
          flowTxId: "0x" + randomHex(64),
          soldAt: new Date().toISOString(),
          records: recordCount,
        };
        setMyListings(prev => prev.map(l =>
          l.id === newListing.id ? { ...l, sales: [sale, ...l.sales] } : l
        ));
        setPendingSale(null);
        addFlowReward(`Data purchased by ${buyer.name}`, newListing.priceFlow);
        toast({
          title: `${buyer.icon ?? "🏛️"} ${buyer.name} purchased your data!`,
          description: `+${newListing.priceFlow} FLOW tokens earned`,
        });
      }, delay);
    } catch {
      toast({ title: "Error", description: "Could not create listing. Try again.", variant: "destructive" });
    } finally {
      setListing(false);
    }
  };

  const buyerTypeColor: Record<string, string> = {
    Research: "bg-blue-100 text-blue-700",
    Government: "bg-green-100 text-green-700",
    AgriTech: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-4">
      {/* Info card */}
      <Card className="bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-100">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Sensor Data Marketplace</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Package your IoT soil data, store it on Filecoin/IPFS, and sell to research institutes
                and government bodies — powered by <span className="font-semibold text-violet-700">Flow blockchain</span>.
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/70 rounded-lg p-2 text-center">
              <p className="text-lg font-bold">{recordCount}</p>
              <p className="text-[10px] text-muted-foreground">Readings</p>
            </div>
            <div className="bg-white/70 rounded-lg p-2 text-center">
              <p className="text-lg font-bold">{myListings.length}</p>
              <p className="text-[10px] text-muted-foreground">Listed</p>
            </div>
            <div className="bg-white/70 rounded-lg p-2 text-center">
              <p className="text-lg font-bold">{myListings.reduce((s, l) => s + l.sales.length, 0)}</p>
              <p className="text-[10px] text-muted-foreground">Sold</p>
            </div>
          </div>

          <Button
            onClick={handleListData}
            disabled={listing || !hasData}
            className="w-full mt-3 bg-violet-600 hover:bg-violet-700 text-white"
            size="sm"
          >
            {listing ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Uploading to Filecoin...</>
            ) : (
              <><Coins className="w-3.5 h-3.5 mr-1.5" />Package & List on Flow (+15 pts)</>
            )}
          </Button>
          {!hasData && (
            <p className="text-[10px] text-center text-muted-foreground mt-1.5">Generate sensor readings first from the Home page</p>
          )}
        </CardContent>
      </Card>

      {/* Buyers info */}
      <Card>
        <CardContent className="p-3">
          <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Active Buyers on Platform</p>
          <div className="space-y-1.5">
            {BUYERS.map(b => (
              <div key={b.name} className="flex items-center justify-between">
                <span className="text-xs">{b.icon} {b.name}</span>
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", buyerTypeColor[b.type])}>{b.type}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* My listings */}
      {myListings.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">My Listings</p>
          {myListings.map(l => (
            <Card key={l.id} className="border-violet-100">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold">{l.title}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{shortCid(l.cid)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-violet-700">{l.priceFlow} FLOW</p>
                    <p className="text-[10px] text-muted-foreground">{l.records} records</p>
                  </div>
                </div>

                {/* Pending sale indicator */}
                {pendingSale === l.id && (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-100">
                    <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                    <p className="text-[11px] text-amber-700">Waiting for buyer to confirm purchase...</p>
                  </div>
                )}

                {/* Completed sales */}
                {l.sales.map(sale => (
                  <div key={sale.id} className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <p className="text-[11px] font-semibold text-emerald-800">{sale.buyer}</p>
                        <span className={cn("text-[9px] px-1 rounded", buyerTypeColor[sale.buyerType])}>{sale.buyerType}</span>
                      </div>
                      <p className="text-xs font-bold text-emerald-700">+{sale.amount} FLOW</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{sale.flowTxId.slice(0, 20)}...</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(sale.soldAt).toLocaleString()}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────────────────────

export default function Analytics() {
  const { t } = useTranslation();

  const { data: history, isLoading: loadingHistory } = useGetSensorHistory({ limit: 50 }, {
    query: { queryKey: getGetSensorHistoryQueryKey({ limit: 50 }) }
  });
  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary({
    query: { queryKey: getGetAnalyticsSummaryQueryKey() }
  });
  const { data: logs, isLoading: loadingLogs } = useGetAnalyticsLogs({}, {
    query: { queryKey: getGetAnalyticsLogsQueryKey({}) }
  });
  const { data: health } = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey() }
  });

  const getLogColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "sensor": return "border-l-blue-500 bg-blue-500/5";
      case "ai": return "border-l-green-500 bg-green-500/5";
      case "insurance": return "border-l-yellow-500 bg-yellow-500/5";
      case "error": return "border-l-red-500 bg-red-500/5";
      default: return "border-l-gray-500 bg-gray-500/5";
    }
  };

  const chartData = history ? [...history].reverse() : [];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("analytics.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("analytics.subtitle")}</p>
        </div>
        {health && (
          <div className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full border border-green-200">
            <CheckCircle className="w-3 h-3" /> {health.status}
          </div>
        )}
      </div>

      <Tabs defaultValue="charts">
        <TabsList className="w-full">
          <TabsTrigger value="charts" className="flex-1 text-xs">
            <BarChart3 className="w-3.5 h-3.5 mr-1" />Charts
          </TabsTrigger>
          <TabsTrigger value="crop-ai" className="flex-1 text-xs">
            <Brain className="w-3.5 h-3.5 mr-1" />Crop AI
          </TabsTrigger>
          <TabsTrigger value="market" className="flex-1 text-xs">
            <ShoppingCart className="w-3.5 h-3.5 mr-1" />Data Market
          </TabsTrigger>
        </TabsList>

        {/* ── Charts Tab ─────────────────────────────────────────────── */}
        <TabsContent value="charts" className="space-y-4 mt-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                <Activity className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-bold">{loadingSummary ? "-" : summary?.totalSensorReadings}</p>
                <p className="text-xs text-muted-foreground">{t("analytics.totalReadings")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                <TrendingUp className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-bold">{loadingSummary ? "-" : `${summary?.avgCropHealth != null ? Math.round(summary.avgCropHealth) : 0}%`}</p>
                <p className="text-xs text-muted-foreground">{t("analytics.avgHealth")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                <FlaskConical className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-bold">{loadingSummary ? "-" : summary?.avgSoilPh != null ? Number(summary.avgSoilPh).toFixed(1) : "-"}</p>
                <p className="text-xs text-muted-foreground">{t("analytics.avgSoilPh")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col justify-center items-center text-center">
                <Droplets className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-bold">{loadingSummary ? "-" : `${summary?.avgMoisture != null ? Math.round(summary.avgMoisture) : 0}%`}</p>
                <p className="text-xs text-muted-foreground">{t("analytics.avgMoisture")}</p>
              </CardContent>
            </Card>
          </div>

          {/* NPK Chart */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                NPK Trends
              </CardTitle>
              <CardDescription className="text-xs">Nitrogen · Phosphorus · Potassium (mg/kg)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                {loadingHistory ? <Skeleton className="w-full h-full" /> : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="createdAt" tickFormatter={t => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11 }} labelFormatter={l => new Date(l).toLocaleString()} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="nitrogen" name="N" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="phosphorus" name="P" stroke="#f97316" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="potassium" name="K" stroke="#a855f7" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{t("analytics.noData")}</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* pH + Moisture Chart */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                pH & Moisture Trends
              </CardTitle>
              <CardDescription className="text-xs">Soil pH · Moisture %</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                {loadingHistory ? <Skeleton className="w-full h-full" /> : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="createdAt" tickFormatter={t => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11 }} labelFormatter={l => new Date(l).toLocaleString()} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="ph" name="pH" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="moisture" name="Moisture %" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{t("analytics.noData")}</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* System Logs */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">{t("analytics.systemActivity")}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : logs && logs.length > 0 ? (
                <div className="space-y-2">
                  {logs.map(log => (
                    <div key={log.id} className={`p-2.5 rounded-lg border-l-4 ${getLogColor(log.eventType)}`}>
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider">{log.eventType}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs font-medium">{log.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4 text-sm">{t("analytics.noActivity")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Crop AI Tab ────────────────────────────────────────────── */}
        <TabsContent value="crop-ai" className="mt-4">
          <CropAITab history={history} />
        </TabsContent>

        {/* ── Data Market Tab ────────────────────────────────────────── */}
        <TabsContent value="market" className="mt-4">
          <DataMarketTab history={history} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
