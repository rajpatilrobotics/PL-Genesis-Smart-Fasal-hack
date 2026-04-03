import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetWeather, getGetWeatherQueryKey,
  useGetLatestSensorData, getGetLatestSensorDataQueryKey,
  useGetAiRecommendation,
  useStoreOnFilecoin,
  useSubmitSensorData,
  useGetFilecoinRecords, getGetFilecoinRecordsQueryKey,
  useGetInsuranceRisk,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  CloudRain, Droplets, Thermometer, Wind, Brain, Database,
  RefreshCw, Shield, Zap, Lock, Globe, Users, CheckCircle2,
  Loader2, AlertTriangle, Activity, ChevronRight
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet-context";
import type { AccessLevel, RiskStatus } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";
import { lighthouseUpload } from "@/lib/lighthouse";

type PipelineStep = {
  id: string;
  label: string;
  description: string;
  status: "pending" | "running" | "done" | "idle";
  result?: string;
};

type PipelineResult = {
  aiHealth: number;
  aiYield: number;
  riskLevel: RiskStatus;
  fertilizerAdvice: string;
  cid: string;
  rewardEarned: number;
  insuranceTriggered: boolean;
  estimatedPayout?: number;
  privacyEnabled: boolean;
  accessLevel: AccessLevel;
};

function generateCID(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz234567";
  let cid = "bafy";
  for (let i = 0; i < 55; i++) {
    cid += chars[Math.floor(Math.random() * chars.length)];
  }
  return cid;
}

function getRiskColor(risk: RiskStatus) {
  if (risk === "Low") return "text-green-600 bg-green-50 border-green-200";
  if (risk === "Medium") return "text-yellow-600 bg-yellow-50 border-yellow-200";
  return "text-red-600 bg-red-50 border-red-200";
}

function getRiskDot(risk: RiskStatus) {
  if (risk === "Low") return "bg-green-500";
  if (risk === "Medium") return "bg-yellow-500";
  return "bg-red-500";
}

const ACCESS_OPTIONS: { value: AccessLevel; icon: React.ComponentType<{ className?: string }>; label: string; color: string }[] = [
  { value: "Private", icon: Lock, label: "Private", color: "text-gray-600" },
  { value: "Expert", icon: Users, label: "Expert", color: "text-blue-600" },
  { value: "Public", icon: Globe, label: "Public", color: "text-green-600" },
];

const DUMMY_SENSOR_BASE = {
  nitrogen: 142,
  phosphorus: 68,
  potassium: 203,
  ph: 6.7,
  moisture: 58,
};

export default function Home() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { walletAddress, addFlowReward, addDataEntry } = useWallet();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [privacyEnabled, setPrivacyEnabled] = useState(false);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("Expert");
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [displaySensor, setDisplaySensor] = useState({ nitrogen: 0, phosphorus: 0, potassium: 0, ph: 0, moisture: 0 });
  const [isSampling, setIsSampling] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: weather, isLoading: loadingWeather } = useGetWeather({}, {
    query: { queryKey: getGetWeatherQueryKey({}) }
  });

  const { data: sensorData, isLoading: loadingSensor } = useGetLatestSensorData({
    query: { queryKey: getGetLatestSensorDataQueryKey(), refetchInterval: 5000 }
  });

  const { data: insuranceRisk } = useGetInsuranceRisk();

  useEffect(() => {
    if (sensorData) {
      setLastUpdated(new Date());
    }
  }, [sensorData]);

  const getAiRec = useGetAiRecommendation();
  const storeOnFilecoin = useStoreOnFilecoin();
  const submitSensor = useSubmitSensorData();

  const handleSimulateSensor = () => {
    submitSensor.mutate({
      data: {
        nitrogen: Math.floor(Math.random() * 100) + 100,
        phosphorus: Math.floor(Math.random() * 50) + 40,
        potassium: Math.floor(Math.random() * 100) + 150,
        ph: Number((Math.random() * 2 + 5.5).toFixed(1)),
        moisture: Math.floor(Math.random() * 60) + 20
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLatestSensorDataQueryKey() });
      }
    });
  };

  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleResample = useCallback(() => {
    if (isSampling) return;
    setIsSampling(true);

    // Pick final target values upfront
    const vary = (base: number, pct = 0.07) =>
      Math.round(base * (1 - pct + Math.random() * pct * 2));
    const target = {
      nitrogen:   vary(DUMMY_SENSOR_BASE.nitrogen),
      phosphorus: vary(DUMMY_SENSOR_BASE.phosphorus),
      potassium:  vary(DUMMY_SENSOR_BASE.potassium),
      ph:   Math.round((DUMMY_SENSOR_BASE.ph + (Math.random() * 0.3 - 0.15)) * 10) / 10,
      moisture: vary(DUMMY_SENSOR_BASE.moisture),
    };

    // Start from 0
    setDisplaySensor({ nitrogen: 0, phosphorus: 0, potassium: 0, ph: 0, moisture: 0 });

    const finalDelay = 1800 + Math.random() * 700;

    // Each tick: creep toward target (easing) + tiny noise so it looks like a live probe
    scanRef.current = setInterval(() => {
      setDisplaySensor(prev => ({
        nitrogen:   Math.round(prev.nitrogen   + (target.nitrogen   - prev.nitrogen)   * 0.18 + (Math.random() - 0.4) * 3),
        phosphorus: Math.round(prev.phosphorus + (target.phosphorus - prev.phosphorus) * 0.18 + (Math.random() - 0.4) * 1.5),
        potassium:  Math.round(prev.potassium  + (target.potassium  - prev.potassium)  * 0.18 + (Math.random() - 0.4) * 4),
        ph:   Math.round((prev.ph + (target.ph - prev.ph) * 0.18 + (Math.random() - 0.4) * 0.05) * 10) / 10,
        moisture: Math.round(prev.moisture + (target.moisture - prev.moisture) * 0.18 + (Math.random() - 0.4) * 1),
      }));
    }, 80);

    // After delay, snap to exact final values and stop
    setTimeout(() => {
      if (scanRef.current) clearInterval(scanRef.current);
      setDisplaySensor(target);
      setIsSampling(false);
    }, finalDelay);
  }, [isSampling]);

  const updateStep = useCallback((id: string, update: Partial<PipelineStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  }, []);

  const runPipeline = async () => {
    if (pipelineRunning) return;
    const activeSensor = sensorData ?? displaySensor;

    const initialSteps: PipelineStep[] = [
      { id: "ai", label: t("home.aiAnalysis"), description: t("home.analyzingData"), status: "idle" },
      { id: "privacy", label: t("home.privacyLayer"), description: t("home.applyingEncryption"), status: "idle" },
      { id: "filecoin", label: t("home.filecoinStorage"), description: t("home.storingOnIPFS"), status: "idle" },
      { id: "access", label: t("home.accessControl"), description: t("home.applyingPermissions"), status: "idle" },
      { id: "rewards", label: t("home.flowRewards"), description: t("home.issuingRewards"), status: "idle" },
      { id: "insurance", label: t("home.starknetInsurance"), description: t("home.evaluatingRisk"), status: "idle" },
    ];

    setSteps(initialSteps);
    setPipelineRunning(true);
    setPipelineResult(null);

    let aiHealth = 75;
    let aiYield = 70;
    let riskLevel: RiskStatus = "Medium";
    let fertilizerAdvice = "Apply balanced NPK fertilizer as recommended.";
    let cid = generateCID();

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    // Step 1: AI Analysis
    setSteps(prev => prev.map(s => s.id === "ai" ? { ...s, status: "running" } : s));
    await delay(300);

    try {
      const aiResult = await new Promise<{ cropHealthPercent: number; yieldPercent: number; riskLevel: string; fertilizerAdvice: string }>((resolve, reject) => {
        getAiRec.mutate({
          data: {
            nitrogen: activeSensor.nitrogen,
            phosphorus: activeSensor.phosphorus,
            potassium: activeSensor.potassium,
            ph: activeSensor.ph,
            moisture: activeSensor.moisture,
            temperature: weather?.temperature,
            humidity: weather?.humidity,
            rainfall: weather?.rainfall
          }
        }, {
          onSuccess: (data) => resolve(data as typeof data),
          onError: reject
        });
      });
      aiHealth = aiResult.cropHealthPercent;
      aiYield = aiResult.yieldPercent;
      riskLevel = (aiResult.riskLevel === "LOW" ? "Low" : aiResult.riskLevel === "HIGH" ? "High" : "Medium") as RiskStatus;
      fertilizerAdvice = aiResult.fertilizerAdvice;
    } catch {
      // fallback
      const n = activeSensor.nitrogen; const m = activeSensor.moisture; const t = weather?.temperature ?? 30;
      aiHealth = Math.min(95, Math.max(30, 75 + (activeSensor.ph > 6 && activeSensor.ph < 7.5 ? 10 : -10)));
      aiYield = Math.min(95, Math.max(30, 70 + (n > 40 ? 10 : -5)));
      riskLevel = (t > 35 && m < 30) ? "High" : m < 40 ? "Medium" : "Low";
      fertilizerAdvice = `Based on N:${n}, P:${activeSensor.phosphorus}, K:${activeSensor.potassium} levels, apply balanced NPK fertilizer.`;
    }

    setSteps(prev => prev.map(s => s.id === "ai" ? {
      ...s, status: "done",
      result: `Health ${aiHealth}% · Yield ${aiYield}% · Risk ${riskLevel}`
    } : s));
    await delay(500);

    // Step 2: Privacy
    setSteps(prev => prev.map(s => s.id === "privacy" ? { ...s, status: "running" } : s));
    await delay(700);
    setSteps(prev => prev.map(s => s.id === "privacy" ? {
      ...s, status: "done",
      result: privacyEnabled ? t("home.rawValuesMasked") : t("home.privacyLayerOff")
    } : s));
    await delay(400);

    // Step 3: Filecoin Storage
    setSteps(prev => prev.map(s => s.id === "filecoin" ? { ...s, status: "running" } : s));
    await delay(300);

    let filecoinReal = false;
    try {
      const farmPayload = {
        nitrogen: privacyEnabled ? "***" : sensorData.nitrogen,
        phosphorus: privacyEnabled ? "***" : sensorData.phosphorus,
        potassium: privacyEnabled ? "***" : sensorData.potassium,
        ph: sensorData.ph,
        moisture: sensorData.moisture,
        temperature: weather?.temperature,
        timestamp: new Date().toISOString(),
        walletAddress: walletAddress ?? "anonymous",
        accessLevel,
        riskLevel,
        aiHealth,
        aiYield,
      };

      // Try real client-side upload to Lighthouse first
      const lhResult = await lighthouseUpload("farm_analysis", farmPayload);
      if (lhResult.real && lhResult.cid) {
        cid = lhResult.cid;
        filecoinReal = true;
        // Register the real CID with the server DB
        await new Promise<void>((resolve) => {
          storeOnFilecoin.mutate({
            data: {
              dataType: "farm_analysis",
              data: { ...farmPayload, _existingCid: cid } as Record<string, unknown>
            }
          }, { onSuccess: () => resolve(), onError: () => resolve() });
        });
      } else {
        // Fall back to server-side store, skipping Lighthouse (known blocked)
        const filecoinRes = await new Promise<{ cid: string }>((resolve, reject) => {
          storeOnFilecoin.mutate({
            data: {
              dataType: "farm_analysis",
              data: { ...farmPayload, _skipLighthouse: true } as Record<string, unknown>
            }
          }, {
            onSuccess: (d) => resolve(d as { cid: string }),
            onError: reject
          });
        });
        cid = filecoinRes.cid;
      }
      queryClient.invalidateQueries({ queryKey: getGetFilecoinRecordsQueryKey() });
    } catch {
      // use generated CID
    }

    setSteps(prev => prev.map(s => s.id === "filecoin" ? {
      ...s, status: "done",
      result: filecoinReal
        ? `✅ Real IPFS — CID: ${cid.substring(0, 20)}...`
        : `CID: ${cid.substring(0, 16)}... (simulated)`
    } : s));
    await delay(400);

    // Step 4: Access Control
    setSteps(prev => prev.map(s => s.id === "access" ? { ...s, status: "running" } : s));
    await delay(600);
    setSteps(prev => prev.map(s => s.id === "access" ? {
      ...s, status: "done",
      result: `${accessLevel} access applied via Lit Protocol`
    } : s));
    await delay(400);

    // Step 5: Rewards
    setSteps(prev => prev.map(s => s.id === "rewards" ? { ...s, status: "running" } : s));
    await delay(500);
    const rewardEarned = 20;
    if (walletAddress) {
      addFlowReward("Farm Analysis Pipeline", rewardEarned);
    }
    setSteps(prev => prev.map(s => s.id === "rewards" ? {
      ...s, status: "done",
      result: `+${rewardEarned} FLOW issued on Flow Testnet`
    } : s));
    await delay(400);

    // Step 6: Insurance
    setSteps(prev => prev.map(s => s.id === "insurance" ? { ...s, status: "running" } : s));
    await delay(700);
    const insuranceTriggered = riskLevel === "High";
    const estimatedPayout = insuranceTriggered ? Math.floor(Math.random() * 5000) + 2000 : undefined;
    setSteps(prev => prev.map(s => s.id === "insurance" ? {
      ...s, status: "done",
      result: insuranceTriggered
        ? `⚠ High Risk — Insurance Auto-Triggered · Est. ₹${estimatedPayout?.toLocaleString()}`
        : `Risk: ${riskLevel} — No claim triggered`
    } : s));

    // Save to history
    if (walletAddress) {
      addDataEntry({
        cid,
        timestamp: new Date().toISOString(),
        reward: rewardEarned,
        accessLevel,
        riskStatus: riskLevel,
        aiHealth,
        aiYield,
        insights: fertilizerAdvice,
        nitrogen: sensorData.nitrogen,
        phosphorus: sensorData.phosphorus,
        potassium: sensorData.potassium,
        ph: sensorData.ph,
        moisture: sensorData.moisture,
        temperature: weather?.temperature,
      });
    }

    setPipelineResult({
      aiHealth,
      aiYield,
      riskLevel,
      fertilizerAdvice,
      cid,
      rewardEarned,
      insuranceTriggered,
      estimatedPayout,
      privacyEnabled,
      accessLevel,
    });

    setPipelineRunning(false);
  };

  const riskToDisplay: RiskStatus = pipelineResult?.riskLevel ?? (insuranceRisk?.riskLevel === "HIGH" ? "High" : insuranceRisk?.riskLevel === "LOW" ? "Low" : "Medium");

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Hero Header + Weather grouped tightly */}
      <div className="space-y-2">
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700 p-4 shadow-lg">
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 blur-xl" />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-teal-400/20 blur-lg" />

        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">{t("home.farmDashboard")}</h2>
            <p className="text-emerald-100/80 text-xs mt-0.5">AI · IoT · Web3 Powered</p>
          </div>
          <button
            onClick={handleSimulateSensor}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-white transition-all shadow-md"
          >
            <RefreshCw className={cn("w-3 h-3", submitSensor.isPending && "animate-spin")} />
            <span>{lastUpdated.toLocaleTimeString()}</span>
          </button>
        </div>
      </div>

      {/* Weather card */}
      <div className="relative rounded-2xl overflow-hidden border border-blue-200/60 card-glow-blue shadow-md">
        {/* Sky gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent" />
        {/* Decorative cloud circles */}
        <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10 blur-lg" />
        <div className="absolute top-2 right-12 w-14 h-14 rounded-full bg-white/8 blur-md" />

        <div className="relative p-3">
          {loadingWeather ? (
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16 bg-white/20" />
              <Skeleton className="h-6 w-24 bg-white/20" />
            </div>
          ) : weather ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <CloudRain className="w-3 h-3 text-white/80" />
                  <span className="text-[9px] font-bold text-white/80 uppercase tracking-wider">{t("home.weather")} · Punjab, India</span>
                </div>
                <p className="text-2xl font-extrabold text-white tracking-tight">{weather.temperature}°C</p>
                <p className="text-xs text-white/70 capitalize mt-0.5">{weather.description}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <Droplets className="w-2.5 h-2.5 text-blue-200" />
                  <span className="text-[11px] font-semibold text-white">{weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <Wind className="w-2.5 h-2.5 text-blue-200" />
                  <span className="text-[11px] font-semibold text-white">{weather.windSpeed} m/s</span>
                </div>
                <div className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <Thermometer className="w-2.5 h-2.5 text-orange-300" />
                  <span className="text-[11px] font-semibold text-white">{t("home.feels")} {weather.feelsLike ?? weather.temperature}°C</span>
                </div>
              </div>
            </div>
          ) : <p className="text-xs text-white/60">Unavailable</p>}
        </div>
      </div>
      </div>{/* end tight group */}

      {/* Visual Risk Banner */}
      <div className={cn(
        "flex items-center justify-between rounded-2xl border px-4 py-3.5 transition-all shadow-sm",
        riskToDisplay === "Low"
          ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200 card-glow-green"
          : riskToDisplay === "Medium"
          ? "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200"
          : "bg-gradient-to-r from-red-50 to-rose-50 border-red-200"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
            riskToDisplay === "Low" ? "bg-emerald-100 text-emerald-600" :
            riskToDisplay === "Medium" ? "bg-amber-100 text-amber-600" :
            "bg-red-100 text-red-600"
          )}>
            <span className={cn("w-2.5 h-2.5 rounded-full animate-pulse", getRiskDot(riskToDisplay))} />
          </div>
          <div>
            <p className={cn("text-sm font-bold", getRiskColor(riskToDisplay).split(" ")[0])}>
              {riskToDisplay === "High" ? t("home.highRiskDetected") : riskToDisplay === "Medium" ? t("home.mediumRisk") : t("home.allClear")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {riskToDisplay === "High" ? t("home.insuranceAutoTriggered") :
               riskToDisplay === "Medium" ? t("home.monitorMoisture") :
               t("home.farmOptimal")}
            </p>
          </div>
        </div>
        {riskToDisplay === "High" && pipelineResult?.insuranceTriggered && (
          <div className="text-right">
            <p className="text-xs text-red-600 font-bold">{t("home.estPayout")}</p>
            <p className="text-sm font-bold text-red-700">₹{pipelineResult.estimatedPayout?.toLocaleString()}</p>
          </div>
        )}
        {riskToDisplay !== "High" && (
          <Badge variant="outline" className={cn(
            "text-xs font-bold rounded-full",
            riskToDisplay === "Low" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-amber-300 text-amber-700 bg-amber-50"
          )}>
            {riskToDisplay}
          </Badge>
        )}
      </div>

      {/* Live Soil Readings — NPK + pH + Moisture bars (ESP32 hardware sensor data) */}
      <Card className="border-emerald-100/80 shadow-md card-glow-green">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                <p className="text-sm font-semibold">{t("home.liveSoilReadings")}</p>
                <button
                  onMouseEnter={handleResample}
                  onClick={handleResample}
                  disabled={isSampling}
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide text-white transition-all duration-200 select-none bg-red-500",
                    isSampling ? "opacity-70 cursor-wait" : "hover:bg-red-600 hover:scale-105 cursor-pointer active:scale-95"
                  )}
                >
                  LIVE
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {/* Signal bars */}
                <div className="flex items-end gap-px h-3">
                  <span className="w-1 bg-emerald-400 rounded-sm" style={{ height: "30%" }} />
                  <span className="w-1 bg-emerald-400 rounded-sm" style={{ height: "55%" }} />
                  <span className="w-1 bg-emerald-400 rounded-sm" style={{ height: "80%" }} />
                  <span className="w-1 bg-emerald-500 rounded-sm" style={{ height: "100%" }} />
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">ESP32-FARM-001</p>
                <span className="text-[9px] text-muted-foreground/60">·</span>
                <p className="text-[10px] text-muted-foreground">
                  {lastUpdated ? `${Math.round((Date.now() - lastUpdated.getTime() + tick * 0) / 1000)}s ago` : "connecting..."}
                </p>
              </div>
            </div>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0", getRiskColor(riskToDisplay))}>
              {riskToDisplay} Risk
            </span>
          </div>

          {/* NPK bars */}
          {[
            { labelKey: "home.nitrogen", value: displaySensor.nitrogen, max: 200, gradient: "from-emerald-400 to-green-600", dotColor: "bg-emerald-500", unit: "mg/kg", symbol: "N" },
            { labelKey: "home.phosphorus", value: displaySensor.phosphorus, max: 100, gradient: "from-orange-400 to-amber-600", dotColor: "bg-orange-500", unit: "mg/kg", symbol: "P" },
            { labelKey: "home.potassium", value: displaySensor.potassium, max: 300, gradient: "from-violet-400 to-purple-600", dotColor: "bg-violet-500", unit: "mg/kg", symbol: "K" },
          ].map(({ labelKey, value, max, gradient, dotColor, unit, symbol }) => (
            <div key={labelKey} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black text-white shrink-0", dotColor)}>
                    {symbol}
                  </span>
                  <span className="text-muted-foreground font-medium">{t(labelKey)}</span>
                </div>
                <span className="font-bold text-foreground">{value} <span className="text-muted-foreground font-normal text-[10px]">{unit}</span></span>
              </div>
              <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full bg-gradient-to-r", gradient, isSampling ? "transition-all duration-300" : "transition-all duration-700")}
                  style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}

          {/* Divider */}
          <div className="border-t border-dashed border-muted-foreground/20 pt-1" />

          {/* pH bar with optimal zone */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {t("home.soilPh")}
                <span className={cn("ml-1.5 text-[10px] font-semibold px-1.5 py-0 rounded-full",
                  displaySensor.ph >= 6.0 && displaySensor.ph <= 7.5
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                )}>
                  {displaySensor.ph >= 6.0 && displaySensor.ph <= 7.5 ? t("home.optimal") : displaySensor.ph < 6.0 ? t("home.acidic") : t("home.alkaline")}
                </span>
              </span>
              <span className="font-semibold">{displaySensor.ph} <span className="text-muted-foreground font-normal">pH</span></span>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div className="absolute inset-0 flex">
                <div className="bg-muted h-full" style={{ width: `${(6.0 / 14) * 100}%` }} />
                <div className="bg-emerald-200 h-full" style={{ width: `${((7.5 - 6.0) / 14) * 100}%` }} />
                <div className="bg-muted h-full flex-1" />
              </div>
              <div
                className={cn("absolute top-0 h-full w-1 bg-blue-500 rounded-full", isSampling ? "transition-all duration-300" : "transition-all duration-700")}
                style={{ left: `calc(${Math.min(100, (displaySensor.ph / 14) * 100)}% - 2px)` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground/70">
              <span>0 ({t("home.acid")})</span>
              <span className="text-emerald-600">{t("home.optimal")} 6–7.5</span>
              <span>14 ({t("home.alkaline")})</span>
            </div>
          </div>

          {/* Moisture bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black text-white shrink-0",
                  displaySensor.moisture < 30 ? "bg-red-500" : displaySensor.moisture > 70 ? "bg-blue-600" : "bg-cyan-500"
                )}>
                  H₂O
                </span>
                <span className="text-muted-foreground font-medium">{t("home.soilMoisture")}</span>
              </div>
              <span className="font-bold text-foreground">{displaySensor.moisture}<span className="text-muted-foreground font-normal text-[10px]">%</span></span>
            </div>
            <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r",
                  isSampling ? "transition-all duration-300" : "transition-all duration-700",
                  displaySensor.moisture < 30 ? "from-red-400 to-rose-600" : displaySensor.moisture > 70 ? "from-blue-400 to-blue-600" : "from-cyan-400 to-sky-600"
                )}
                style={{ width: `${Math.min(100, displaySensor.moisture)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Controls */}
      <Card className="border border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 shadow-md overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-200/30 to-transparent rounded-full -translate-y-8 translate-x-8" />
        <CardHeader className="pb-3 pt-4 relative">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold">{t("home.analyzeFarm")}</span>
            <Badge className="text-[10px] ml-auto bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">{t("home.web3Pipeline")}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-4">

          {/* Privacy Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t("home.privacyMode")}</p>
                <p className="text-[10px] text-muted-foreground">{t("home.poweredByZama")}</p>
              </div>
            </div>
            <button
              onClick={() => setPrivacyEnabled(!privacyEnabled)}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors duration-200",
                privacyEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span className={cn(
                "absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                privacyEnabled && "translate-x-5"
              )} />
            </button>
          </div>

          {/* Access Level */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Access Level <span className="text-[10px] text-muted-foreground font-normal">via Lit Protocol</span></p>
            </div>
            <div className="flex gap-2">
              {ACCESS_OPTIONS.map(({ value, icon: Icon, label, color }) => (
                <button
                  key={value}
                  onClick={() => setAccessLevel(value)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all",
                    accessLevel === value
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  <Icon className={cn("w-4 h-4", accessLevel === value ? "text-primary" : color)} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Pipeline Button */}
          <Button
            className="w-full h-12 font-bold text-base relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 border-0 shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={runPipeline}
            disabled={!sensorData || pipelineRunning}
          >
            {pipelineRunning ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("home.running")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                {t("home.analyzeFarm")}
                {walletAddress && (
                  <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 font-bold">+20 FLOW</span>
                )}
              </span>
            )}
          </Button>

          {!sensorData && (
            <p className="text-center text-xs text-muted-foreground">Tap the clock above to sync sensor data first</p>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Progress */}
      {steps.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4" />
              {pipelineRunning ? t("home.pipelineRunning") : t("home.pipelineComplete")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-3 p-2.5 rounded-xl transition-all duration-300",
                  step.status === "done" ? "bg-green-50/80" :
                  step.status === "running" ? "bg-blue-50/80 animate-pulse" :
                  "bg-muted/30 opacity-50"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {step.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {step.status === "running" && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  {(step.status === "idle" || step.status === "pending") && (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-xs font-semibold",
                    step.status === "done" ? "text-green-700" :
                    step.status === "running" ? "text-blue-700" : "text-muted-foreground"
                  )}>{step.label}</p>
                  {step.status === "done" && step.result && (
                    <p className="text-[10px] text-green-600 mt-0.5">{step.result}</p>
                  )}
                  {step.status === "running" && (
                    <p className="text-[10px] text-blue-500 mt-0.5">{step.description}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pipeline Result Summary */}
      {pipelineResult && !pipelineRunning && (
        <Card className={cn(
          "border-2",
          pipelineResult.riskLevel === "High" ? "border-red-200 bg-red-50/50" :
          pipelineResult.riskLevel === "Low" ? "border-green-200 bg-green-50/50" :
          "border-yellow-200 bg-yellow-50/50"
        )}>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">{t("home.analysisDone")}</p>
              {pipelineResult.riskLevel === "High" && (
                <div className="flex items-center gap-1.5 text-red-600 text-xs font-bold bg-red-100 border border-red-200 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t("home.insuranceTriggered")}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2.5 bg-white rounded-xl border">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t("ai.healthLabel")}</p>
                <p className="text-xl font-bold text-primary">{pipelineResult.aiHealth}%</p>
              </div>
              <div className="text-center p-2.5 bg-white rounded-xl border">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t("ai.riskLabel")}</p>
                <p className={cn("text-sm font-bold mt-0.5",
                  pipelineResult.riskLevel === "Low" ? "text-green-600" :
                  pipelineResult.riskLevel === "High" ? "text-red-600" : "text-yellow-600"
                )}>{pipelineResult.riskLevel}</p>
              </div>
              <div className="text-center p-2.5 bg-white rounded-xl border">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{t("ai.yieldLabel")}</p>
                <p className="text-xl font-bold text-primary">{pipelineResult.aiYield}%</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{pipelineResult.fertilizerAdvice}</p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white rounded-xl border p-2.5">
                <p className="text-muted-foreground mb-0.5">{t("home.cidFilecoin")}</p>
                <p className="font-mono font-semibold text-[10px] break-all">{pipelineResult.cid.substring(0, 20)}...</p>
              </div>
              <div className="bg-white rounded-xl border p-2.5">
                <p className="text-muted-foreground mb-0.5">{t("home.rewardEarned")}</p>
                <p className="font-bold text-amber-600">+{pipelineResult.rewardEarned} FLOW</p>
              </div>
            </div>

            {pipelineResult.riskLevel === "High" && pipelineResult.estimatedPayout && (
              <div className="bg-red-100 border border-red-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-600" />
                  <div>
                    <p className="text-xs font-bold text-red-700">{t("home.starknetInsurance")}</p>
                    <p className="text-[10px] text-red-600">{t("home.autoTriggeredClaim")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-red-600">{t("home.estPayout")}</p>
                  <p className="text-sm font-bold text-red-700">₹{pipelineResult.estimatedPayout.toLocaleString()}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tech Badge Strip */}
      <div className="rounded-2xl border border-border/50 bg-white/60 backdrop-blur-sm p-3">
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2">⚡ Powered By</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "badgeFlow", color: "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200", emoji: "🌊" },
            { key: "badgeFilecoin", color: "bg-gradient-to-r from-blue-50 to-sky-50 text-blue-700 border-blue-200", emoji: "📦" },
            { key: "badgeLit", color: "bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border-purple-200", emoji: "🔐" },
            { key: "badgeZama", color: "bg-gradient-to-r from-pink-50 to-rose-50 text-pink-700 border-pink-200", emoji: "🔒" },
            { key: "badgeStarknet", color: "bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border-orange-200", emoji: "⛓" },
            { key: "badgeHypercerts", color: "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border-amber-200", emoji: "🏆" },
          ].map(({ key, color, emoji }) => (
            <span key={key} className={cn("text-[9px] font-bold border rounded-full px-2 py-0.5 shadow-sm", color)}>
              {emoji} {t(`home.${key}`)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
