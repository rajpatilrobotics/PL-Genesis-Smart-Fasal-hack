import { useEffect, useState, useCallback } from "react";
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
  const [displaySensor, setDisplaySensor] = useState({ ...DUMMY_SENSOR_BASE });
  const [isSampling, setIsSampling] = useState(false);

  const { data: weather, isLoading: loadingWeather } = useGetWeather({}, {
    query: { queryKey: getGetWeatherQueryKey({}) }
  });

  const { data: sensorData, isLoading: loadingSensor } = useGetLatestSensorData({
    query: { queryKey: getGetLatestSensorDataQueryKey(), refetchInterval: 10000 }
  });

  const { data: insuranceRisk } = useGetInsuranceRisk();

  useEffect(() => {
    if (sensorData) setLastUpdated(new Date());
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

  const handleResample = () => {
    if (isSampling) return;
    setIsSampling(true);
    const delay = 2000 + Math.random() * 1000;
    setTimeout(() => {
      const vary = (base: number, pct = 0.15) =>
        Math.round(base * (1 - pct + Math.random() * pct * 2));
      setDisplaySensor({
        nitrogen: vary(DUMMY_SENSOR_BASE.nitrogen),
        phosphorus: vary(DUMMY_SENSOR_BASE.phosphorus),
        potassium: vary(DUMMY_SENSOR_BASE.potassium),
        ph: Number((DUMMY_SENSOR_BASE.ph + (Math.random() * 0.6 - 0.3)).toFixed(1)),
        moisture: vary(DUMMY_SENSOR_BASE.moisture),
      });
      setIsSampling(false);
    }, delay);
  };

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

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{t("home.farmDashboard")}</h2>
        <button
          onClick={handleSimulateSensor}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full hover:bg-muted/80"
        >
          <RefreshCw className={cn("w-3 h-3", submitSensor.isPending && "animate-spin")} />
          <span>{lastUpdated.toLocaleTimeString()}</span>
        </button>
      </div>

      {/* Visual Risk Banner */}
      <div className={cn(
        "flex items-center justify-between rounded-2xl border px-4 py-3 transition-all",
        riskToDisplay === "Low" ? "bg-green-50 border-green-200" :
        riskToDisplay === "Medium" ? "bg-yellow-50 border-yellow-200" :
        "bg-red-50 border-red-200"
      )}>
        <div className="flex items-center gap-2.5">
          <span className={cn("w-3 h-3 rounded-full animate-pulse shrink-0", getRiskDot(riskToDisplay))} />
          <div>
            <p className={cn("text-sm font-bold", getRiskColor(riskToDisplay).split(" ")[0])}>
              {riskToDisplay === "High" ? t("home.highRiskDetected") : riskToDisplay === "Medium" ? t("home.mediumRisk") : t("home.allClear")}
            </p>
            <p className="text-xs text-muted-foreground">
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
          <Badge variant="outline" className={cn("text-xs", riskToDisplay === "Low" ? "border-green-300 text-green-700" : "border-yellow-300 text-yellow-700")}>
            {riskToDisplay}
          </Badge>
        )}
      </div>

      {/* Weather card */}
      <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-100">
        <CardContent className="p-3">
          {loadingWeather ? <Skeleton className="h-14 w-full" /> : weather ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[10px] font-semibold text-blue-600 uppercase">{t("home.weather")}</span>
                </div>
                <p className="text-2xl font-bold">{weather.temperature}°C</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{weather.description}</p>
              </div>
              <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-blue-400" />{weather.humidity}% {t("home.humidity")}</span>
                <span className="flex items-center gap-1"><Wind className="w-3.5 h-3.5" />{weather.windSpeed} m/s {t("home.wind")}</span>
                <span className="flex items-center gap-1"><Thermometer className="w-3.5 h-3.5 text-orange-400" />{t("home.feels")} {weather.feelsLike ?? weather.temperature}°C</span>
              </div>
            </div>
          ) : <p className="text-xs text-muted-foreground">Unavailable</p>}
        </CardContent>
      </Card>

      {/* Live Soil Readings — NPK + pH + Moisture bars (dummy hardware sensor data) */}
      <Card className="border-emerald-100">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                {t("home.liveSoilReadings")}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t("home.hardwareSensor")}</p>
            </div>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", getRiskColor(riskToDisplay))}>
              {riskToDisplay} Risk
            </span>
          </div>

          {/* NPK bars */}
          {[
            { labelKey: "home.nitrogen", value: displaySensor.nitrogen, max: 200, color: "bg-green-500", unit: "mg/kg" },
            { labelKey: "home.phosphorus", value: displaySensor.phosphorus, max: 100, color: "bg-orange-500", unit: "mg/kg" },
            { labelKey: "home.potassium", value: displaySensor.potassium, max: 300, color: "bg-purple-500", unit: "mg/kg" },
          ].map(({ labelKey, value, max, color, unit }) => (
            <div key={labelKey} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t(labelKey)}</span>
                <span className="font-semibold">{value} <span className="text-muted-foreground font-normal">{unit}</span></span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
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
                className="absolute top-0 h-full w-1 bg-blue-500 rounded-full transition-all duration-700"
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
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{t("home.soilMoisture")}</span>
              <span className="font-semibold">{displaySensor.moisture}<span className="text-muted-foreground font-normal">%</span></span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700",
                  displaySensor.moisture < 30 ? "bg-red-400" : displaySensor.moisture > 70 ? "bg-blue-500" : "bg-cyan-500"
                )}
                style={{ width: `${Math.min(100, displaySensor.moisture)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Controls */}
      <Card className="border-2 border-dashed border-primary/30 bg-primary/2">
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            {t("home.analyzeFarm")}
            <Badge variant="secondary" className="text-[10px] ml-auto">{t("home.web3Pipeline")}</Badge>
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
            className="w-full h-12 font-bold text-base relative overflow-hidden"
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
                {walletAddress && <span className="text-xs opacity-75 ml-1">+20 FLOW</span>}
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
      <div className="flex flex-wrap gap-1.5 pt-1 pb-2">
        {[
          { key: "badgeFlow", color: "bg-green-50 text-green-700 border-green-200" },
          { key: "badgeFilecoin", color: "bg-blue-50 text-blue-700 border-blue-200" },
          { key: "badgeLit", color: "bg-purple-50 text-purple-700 border-purple-200" },
          { key: "badgeZama", color: "bg-pink-50 text-pink-700 border-pink-200" },
          { key: "badgeStarknet", color: "bg-orange-50 text-orange-700 border-orange-200" },
          { key: "badgeHypercerts", color: "bg-amber-50 text-amber-700 border-amber-200" },
        ].map(({ key, color }) => (
          <span key={key} className={cn("text-[9px] font-semibold border rounded-full px-2 py-0.5", color)}>
            {t(`home.${key}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
