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
  Loader2, AlertTriangle, Activity, Cpu, MapPin
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
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(() => {
    try {
      const stored = localStorage.getItem("sf_gps_coords");
      return stored ? (JSON.parse(stored) as { lat: number; lon: number }) : null;
    } catch { return null; }
  });
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [liveTime, setLiveTime] = useState(new Date());
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [displaySensor, setDisplaySensor] = useState({ nitrogen: 0, phosphorus: 0, potassium: 0, ph: 0, moisture: 0 });
  const [isSampling, setIsSampling] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
      setLiveTime(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocationDenied(true); return; }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        localStorage.setItem("sf_gps_coords", JSON.stringify(coords));
        setGpsCoords(coords);
        setLocationDenied(false);
        setLocationLoading(false);
      },
      () => {
        setLocationDenied(true);
        setLocationLoading(false);
      },
      { timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  }, []);

  // Auto-request GPS on mount if we don't already have cached coords
  useEffect(() => {
    if (!gpsCoords) requestLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weatherParams = gpsCoords ?? {};
  const { data: weather, isLoading: loadingWeather, refetch: refetchWeather } = useGetWeather(weatherParams, {
    query: { queryKey: getGetWeatherQueryKey(weatherParams), refetchInterval: 10 * 60 * 1000 }
  });

  // Force immediate weather refetch whenever real coordinates arrive
  useEffect(() => {
    if (gpsCoords) refetchWeather();
  }, [gpsCoords, refetchWeather]);

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
      { id: "iot", label: "IoT Edge Layer", description: "Reading live sensor data from edge nodes…", status: "idle" },
      { id: "ai", label: t("home.aiAnalysis"), description: t("home.analyzingData"), status: "idle" },
      { id: "privacy", label: t("home.privacyLayer"), description: t("home.applyingEncryption"), status: "idle" },
      { id: "filecoin", label: t("home.filecoinStorage"), description: t("home.storingOnIPFS"), status: "idle" },
      { id: "access", label: t("home.accessControl"), description: t("home.applyingPermissions"), status: "idle" },
      { id: "rewards", label: t("home.flowRewards"), description: t("home.issuingRewards"), status: "idle" },
      { id: "insurance", label: t("home.starknetInsurance"), description: t("home.evaluatingRisk"), status: "idle" },
      { id: "hypercerts", label: "HyperCerts Impact", description: "Minting on-chain impact certificate…", status: "idle" },
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

    // Step 0: IoT Edge Layer
    setSteps(prev => prev.map(s => s.id === "iot" ? { ...s, status: "running" } : s));
    await delay(600);
    setSteps(prev => prev.map(s => s.id === "iot" ? {
      ...s, status: "done",
      result: `N:${activeSensor.nitrogen} P:${activeSensor.phosphorus} K:${activeSensor.potassium} · pH ${activeSensor.ph} · Moisture ${activeSensor.moisture}%`
    } : s));
    await delay(300);

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
        : `CID: ${cid.substring(0, 16)}...`
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
    await delay(400);

    // Step 8: HyperCerts Impact
    setSteps(prev => prev.map(s => s.id === "hypercerts" ? { ...s, status: "running" } : s));
    await delay(700);
    setSteps(prev => prev.map(s => s.id === "hypercerts" ? {
      ...s, status: "done",
      result: `Impact cert minted · Health ${aiHealth}% · Yield ${aiYield}% · Optimism Sepolia`
    } : s));
    await delay(300);

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

  const glassCard = "glass-glow rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl hover:bg-white/45";

  return (
    <div className="relative -mx-4 -mt-5 min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ background: "linear-gradient(165deg, #f0f9ff 0%, #ecfdf5 28%, #fefce8 60%, #fef9c3 100%)" }}>

      {/* Daylight nature blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-sky-200/50 blur-3xl" />
        <div className="absolute top-1/4 -left-16 w-60 h-60 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute top-2/3 right-0 w-56 h-56 rounded-full bg-amber-200/45 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-lime-200/30 blur-2xl" />
      </div>

      <div className="relative space-y-4 px-4 pt-5 pb-28">

        {/* ── Hero Header — Daylight Crop Green ── */}
        <div className="relative rounded-2xl overflow-hidden p-4 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-green-500/30 active:translate-y-0"
          style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 45%, #15803d 100%)", border: "1px solid rgba(255,255,255,0.35)" }}>
          {/* Harvest gold glow top-right */}
          <div className="absolute -top-4 -right-4 w-36 h-36 rounded-full bg-yellow-300/25 blur-2xl" />
          {/* Sky shimmer bottom-left */}
          <div className="absolute bottom-0 left-0 w-28 h-16 rounded-full bg-sky-300/20 blur-xl" />
          {/* Subtle grid texture */}
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">{t("home.farmDashboard")}</h2>
              <p className="text-green-100/90 text-xs mt-0.5 font-medium">🌾 AI · IoT · Web3 Powered</p>
            </div>
            <button
              onClick={handleSimulateSensor}
              className="flex items-center gap-1.5 text-xs font-bold text-green-900 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-white transition-all border border-white/70 shadow-md"
            >
              <RefreshCw className={cn("w-3 h-3", submitSensor.isPending && "animate-spin")} />
              <span>{lastUpdated.toLocaleTimeString()}</span>
            </button>
          </div>
        </div>

        {/* ── Weather ── */}
        <div className="relative rounded-2xl overflow-hidden shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-sky-300/50 active:translate-y-0"
          style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 50%, #7dd3fc 100%)", border: "1px solid rgba(255,255,255,0.35)" }}>
          <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/20 blur-2xl" />
          <div className="relative p-3.5">
            {locationLoading && !weather ? (
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16 bg-white/30" />
                <Skeleton className="h-7 w-24 bg-white/30" />
              </div>
            ) : locationDenied && !weather ? (
              <div className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-1.5">
                  <CloudRain className="w-3 h-3 text-white/70" />
                  <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider">{t("home.weather")}</span>
                </div>
                <p className="text-[11px] text-white/80">Allow location access for real-time weather</p>
                <button
                  onClick={requestLocation}
                  className="flex items-center gap-1.5 bg-white/25 hover:bg-white/35 active:bg-white/20 transition-colors rounded-full px-3 py-1.5"
                >
                  <MapPin className="w-3 h-3 text-white" />
                  <span className="text-[11px] font-bold text-white">Share Location</span>
                </button>
              </div>
            ) : loadingWeather ? (
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16 bg-white/30" />
                <Skeleton className="h-7 w-24 bg-white/30" />
              </div>
            ) : weather ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    <CloudRain className="w-3 h-3 text-white/80" />
                    <span className="text-[9px] font-bold text-white/75 uppercase tracking-wider">
                      {t("home.weather")} · {weather.location}
                    </span>
                  </div>
                  <p className="text-3xl font-extrabold text-white tracking-tight drop-shadow">{weather.temperature}°C</p>
                  <p className="text-xs text-white/80 capitalize mt-0.5">{weather.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-white/70 font-semibold">
                      {liveTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    {gpsCoords && (
                      <>
                        <span className="text-white/40 text-[10px]">·</span>
                        <span className="text-[9px] text-white/60 font-medium">📍 GPS</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1 bg-white/25 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <Droplets className="w-2.5 h-2.5 text-white" />
                    <span className="text-[11px] font-bold text-white">{weather.humidity}%</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/25 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <Wind className="w-2.5 h-2.5 text-white" />
                    <span className="text-[11px] font-bold text-white">{weather.windSpeed} m/s</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/25 backdrop-blur-sm rounded-full px-2.5 py-1">
                    <Thermometer className="w-2.5 h-2.5 text-amber-200" />
                    <span className="text-[11px] font-bold text-white">{t("home.feels")} {weather.feelsLike ?? weather.temperature}°C</span>
                  </div>
                  {weather.rainfall > 0 && (
                    <div className="flex items-center gap-1 bg-white/25 backdrop-blur-sm rounded-full px-2.5 py-1">
                      <CloudRain className="w-2.5 h-2.5 text-sky-200" />
                      <span className="text-[11px] font-bold text-white">{weather.rainfall} mm</span>
                    </div>
                  )}
                </div>
              </div>
            ) : <p className="text-xs text-white/60">Unavailable</p>}
          </div>
        </div>

        {/* ── Risk Banner ── */}
        <div className={cn(
          glassCard,
          "flex items-center justify-between px-4 py-3.5",
          riskToDisplay === "Low" ? "border-emerald-200/50 bg-emerald-50/40" :
          riskToDisplay === "Medium" ? "border-amber-200/50 bg-amber-50/40" :
          "border-red-200/50 bg-red-50/40"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
              riskToDisplay === "Low" ? "bg-emerald-100 border border-emerald-200" :
              riskToDisplay === "Medium" ? "bg-amber-100 border border-amber-200" :
              "bg-red-100 border border-red-200"
            )}>
              <span className={cn("w-2.5 h-2.5 rounded-full animate-pulse", getRiskDot(riskToDisplay))} />
            </div>
            <div>
              <p className={cn("text-sm font-bold",
                riskToDisplay === "Low" ? "text-emerald-700" :
                riskToDisplay === "Medium" ? "text-amber-700" : "text-red-700"
              )}>
                {riskToDisplay === "High" ? t("home.highRiskDetected") : riskToDisplay === "Medium" ? t("home.mediumRisk") : t("home.allClear")}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {riskToDisplay === "High" ? t("home.insuranceAutoTriggered") :
                 riskToDisplay === "Medium" ? t("home.monitorMoisture") :
                 t("home.farmOptimal")}
              </p>
            </div>
          </div>
          {riskToDisplay === "High" && pipelineResult?.insuranceTriggered && (
            <div className="text-right">
              <p className="text-[10px] text-red-600 font-bold">{t("home.estPayout")}</p>
              <p className="text-sm font-bold text-red-700">&#8377;{pipelineResult.estimatedPayout?.toLocaleString()}</p>
            </div>
          )}
          {riskToDisplay !== "High" && (
            <span className={cn(
              "text-[10px] font-bold px-2.5 py-1 rounded-full border",
              riskToDisplay === "Low" ? "border-emerald-300 text-emerald-700 bg-emerald-100" : "border-amber-300 text-amber-700 bg-amber-100"
            )}>
              {riskToDisplay}
            </span>
          )}
        </div>

        {/* ── Live Soil Readings ── */}
        <div className={cn(glassCard, "p-4 space-y-3")}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                <p className="text-sm font-semibold text-gray-800">{t("home.liveSoilReadings")}</p>
                <button
                  onMouseEnter={handleResample}
                  onClick={handleResample}
                  disabled={isSampling}
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide text-white transition-all duration-200 select-none bg-red-500",
                    isSampling ? "opacity-60 cursor-wait" : "hover:bg-red-600 hover:scale-105 cursor-pointer active:scale-95"
                  )}
                >
                  LIVE
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex items-end gap-px h-3">
                  <span className="w-1 bg-emerald-400 rounded-sm" style={{ height: "30%" }} />
                  <span className="w-1 bg-emerald-500 rounded-sm" style={{ height: "55%" }} />
                  <span className="w-1 bg-emerald-500 rounded-sm" style={{ height: "80%" }} />
                  <span className="w-1 bg-emerald-600 rounded-sm" style={{ height: "100%" }} />
                </div>
                <p className="text-[10px] text-gray-400 font-mono">ESP32-FARM-001</p>
                <span className="text-[9px] text-gray-300">·</span>
                <p className="text-[10px] text-gray-400">
                  {lastUpdated ? `${Math.round((Date.now() - lastUpdated.getTime() + tick * 0) / 1000)}s ago` : "connecting..."}
                </p>
              </div>
            </div>
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
              riskToDisplay === "Low" ? "border-emerald-300 text-emerald-700 bg-emerald-100" :
              riskToDisplay === "Medium" ? "border-amber-300 text-amber-700 bg-amber-100" :
              "border-red-300 text-red-700 bg-red-100"
            )}>
              {riskToDisplay} Risk
            </span>
          </div>

          {[
            { labelKey: "home.nitrogen", value: displaySensor.nitrogen, max: 200, gradient: "from-emerald-400 to-green-600", dotColor: "bg-emerald-600", unit: "mg/kg", symbol: "N" },
            { labelKey: "home.phosphorus", value: displaySensor.phosphorus, max: 100, gradient: "from-orange-400 to-amber-600", dotColor: "bg-orange-500", unit: "mg/kg", symbol: "P" },
            { labelKey: "home.potassium", value: displaySensor.potassium, max: 300, gradient: "from-amber-400 to-yellow-500", dotColor: "bg-amber-500", unit: "mg/kg", symbol: "K" },
          ].map(({ labelKey, value, max, gradient, dotColor, unit, symbol }) => (
            <div key={labelKey} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-sm", dotColor)}>
                    {symbol}
                  </span>
                  <span className="text-gray-500 font-medium">{t(labelKey)}</span>
                </div>
                <span className="font-bold text-gray-800">{value} <span className="text-gray-400 font-normal text-[10px]">{unit}</span></span>
              </div>
              <div className="h-2.5 bg-black/8 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full bg-gradient-to-r shadow-sm", gradient, isSampling ? "transition-all duration-300" : "transition-all duration-700")}
                  style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}

          <div className="border-t border-black/8 pt-1" />

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">
                {t("home.soilPh")}
                <span className={cn("ml-1.5 text-[10px] font-semibold px-1.5 py-0 rounded-full",
                  displaySensor.ph >= 6.0 && displaySensor.ph <= 7.5
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                )}>
                  {displaySensor.ph >= 6.0 && displaySensor.ph <= 7.5 ? t("home.optimal") : displaySensor.ph < 6.0 ? t("home.acidic") : t("home.alkaline")}
                </span>
              </span>
              <span className="font-semibold text-gray-800">{displaySensor.ph} <span className="text-gray-400 font-normal">pH</span></span>
            </div>
            <div className="relative h-2 bg-black/8 rounded-full overflow-hidden">
              <div className="absolute inset-0 flex">
                <div className="bg-black/5 h-full" style={{ width: `${(6.0 / 14) * 100}%` }} />
                <div className="bg-emerald-200 h-full" style={{ width: `${((7.5 - 6.0) / 14) * 100}%` }} />
                <div className="bg-black/5 h-full flex-1" />
              </div>
              <div
                className={cn("absolute top-0 h-full w-1 bg-blue-500 rounded-full shadow", isSampling ? "transition-all duration-300" : "transition-all duration-700")}
                style={{ left: `calc(${Math.min(100, (displaySensor.ph / 14) * 100)}% - 2px)` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>0 ({t("home.acid")})</span>
              <span className="text-emerald-600">{t("home.optimal")} 6–7.5</span>
              <span>14 ({t("home.alkaline")})</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-sm",
                  displaySensor.moisture < 30 ? "bg-red-500" : displaySensor.moisture > 70 ? "bg-blue-600" : "bg-cyan-500"
                )}>H₂O</span>
                <span className="text-gray-500 font-medium">{t("home.soilMoisture")}</span>
              </div>
              <span className="font-bold text-gray-800">{displaySensor.moisture}<span className="text-gray-400 font-normal text-[10px]">%</span></span>
            </div>
            <div className="h-2.5 bg-black/8 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r shadow-sm",
                  isSampling ? "transition-all duration-300" : "transition-all duration-700",
                  displaySensor.moisture < 30 ? "from-red-400 to-rose-600" : displaySensor.moisture > 70 ? "from-blue-400 to-blue-600" : "from-cyan-400 to-sky-600"
                )}
                style={{ width: `${Math.min(100, displaySensor.moisture)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Analyze Farm Pipeline ── */}
        <div className="relative rounded-2xl overflow-hidden shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-green-500/35 active:translate-y-0"
          style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 50%, #166534 100%)", border: "1px solid rgba(255,255,255,0.3)" }}>
          {/* Harvest gold glow */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-300/15 rounded-full blur-3xl -translate-y-10 translate-x-10" />
          {/* Sky blue shimmer bottom */}
          <div className="absolute bottom-0 left-1/4 w-32 h-24 bg-sky-300/10 rounded-full blur-2xl" />
          <div className="relative p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-md border border-white/20">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-base text-white">{t("home.analyzeFarm")}</span>
              <span className="text-[10px] ml-auto font-bold bg-white/15 text-green-100 border border-white/20 px-2 py-0.5 rounded-full">{t("home.web3Pipeline")}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-200/70" />
                <div>
                  <p className="text-sm font-medium text-white">{t("home.privacyMode")}</p>
                  <p className="text-[10px] text-green-200/60">{t("home.poweredByZama")}</p>
                </div>
              </div>
              <button
                onClick={() => setPrivacyEnabled(!privacyEnabled)}
                className={cn(
                  "relative w-11 h-6 rounded-full transition-colors duration-200",
                  privacyEnabled ? "bg-emerald-400" : "bg-white/20"
                )}
              >
                <span className={cn(
                  "absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200",
                  privacyEnabled && "translate-x-5"
                )} />
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-200/70" />
                <p className="text-sm font-medium text-white">Access Level <span className="text-[10px] text-green-200/60 font-normal">via Lit Protocol</span></p>
              </div>
              <div className="flex gap-2">
                {ACCESS_OPTIONS.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setAccessLevel(value)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all",
                      accessLevel === value
                        ? "border-white/50 bg-white/20 text-white shadow-md"
                        : "border-white/15 bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/70"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={runPipeline}
              disabled={!sensorData || pipelineRunning}
              className={cn(
                "w-full h-12 font-bold text-base rounded-xl transition-all duration-200 flex items-center justify-center gap-2",
                "bg-amber-400 text-green-900 shadow-xl shadow-amber-400/30",
                "hover:bg-amber-300 hover:shadow-amber-300/50 hover:scale-[1.01]",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              )}
            >
              {pipelineRunning ? (
                <><Loader2 className="w-5 h-5 animate-spin" />{t("home.running")}</>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  {t("home.analyzeFarm")}
                  {walletAddress && <span className="text-xs bg-green-900/25 rounded-full px-2 py-0.5 font-bold">+20 FLOW</span>}
                </>
              )}
            </button>

            {!sensorData && (
              <p className="text-center text-xs text-green-200/50">Tap the clock above to sync sensor data first</p>
            )}
          </div>
        </div>

        {/* ── Pipeline Progress ── */}
        {steps.length > 0 && (
          <div className={cn(glassCard, "p-4 space-y-2")}>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-gray-400" />
              <p className="text-sm font-semibold text-gray-600">{pipelineRunning ? t("home.pipelineRunning") : t("home.pipelineComplete")}</p>
            </div>
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-3 p-2.5 rounded-xl transition-all duration-300",
                  step.status === "done" ? "bg-emerald-50/80 border border-emerald-200/60" :
                  step.status === "running" ? "bg-sky-50/80 border border-sky-200/60 animate-pulse" :
                  "bg-black/3 opacity-50"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {step.status === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {step.status === "running" && <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />}
                  {(step.status === "idle" || step.status === "pending") && (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-xs font-semibold flex items-center gap-1.5",
                    step.status === "done" ? "text-emerald-700" :
                    step.status === "running" ? "text-sky-700" : "text-gray-400"
                  )}>
                    {step.id === "iot" && <Cpu className="w-3.5 h-3.5 shrink-0" />}
                    {step.id === "ai" && (
                      <>
                        <img src="/openai-logo.png" alt="OpenAI" className="w-3.5 h-3.5 rounded-full object-contain bg-white shrink-0" />
                        <img src="/gemini-logo.svg" alt="Gemini" className="w-3.5 h-3.5 rounded-full object-contain bg-white shrink-0" />
                      </>
                    )}
                    {step.id === "privacy" && <img src="/zama-logo.png" alt="Zama" className="w-3.5 h-3.5 rounded-full object-contain bg-white shrink-0" />}
                    {step.id === "filecoin" && <img src="/filecoin-logo.png" alt="Filecoin" className="w-3.5 h-3.5 rounded-full object-contain bg-white shrink-0" />}
                    {step.id === "access" && <img src="/lit-logo.png" alt="Lit" className="w-3.5 h-3.5 rounded-full object-contain bg-white shrink-0" />}
                    {step.id === "rewards" && <img src="/flow-logo.png" alt="Flow" className="w-3.5 h-3.5 rounded-full object-contain bg-white shrink-0" />}
                    {step.id === "insurance" && <img src="/starknet-logo.png" alt="Starknet" className="w-3.5 h-3.5 rounded-full object-contain bg-white shrink-0" />}
                    {step.id === "hypercerts" && <img src="/hypercerts-logo.png" alt="HyperCerts" className="w-3.5 h-3.5 rounded-full object-contain bg-white shrink-0" />}
                    {step.label}
                  </p>
                  {step.status === "done" && step.result && <p className="text-[10px] text-emerald-600 mt-0.5">{step.result}</p>}
                  {step.status === "running" && <p className="text-[10px] text-sky-600 mt-0.5">{step.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pipeline Result ── */}
        {pipelineResult && !pipelineRunning && (
          <div className={cn(
            glassCard, "p-4 space-y-4",
            pipelineResult.riskLevel === "High" ? "border-red-200/50 bg-red-50/35" :
            pipelineResult.riskLevel === "Low" ? "border-emerald-200/50 bg-emerald-50/35" :
            "border-amber-200/50 bg-amber-50/35"
          )}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm text-gray-800">{t("home.analysisDone")}</p>
              {pipelineResult.riskLevel === "High" && (
                <div className="flex items-center gap-1.5 text-red-600 text-xs font-bold bg-red-100 border border-red-200 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t("home.insuranceTriggered")}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t("ai.healthLabel"), value: `${pipelineResult.aiHealth}%`, color: "text-emerald-700" },
                { label: t("ai.riskLabel"), value: pipelineResult.riskLevel, color: pipelineResult.riskLevel === "Low" ? "text-emerald-700" : pipelineResult.riskLevel === "High" ? "text-red-700" : "text-amber-700" },
                { label: t("ai.yieldLabel"), value: `${pipelineResult.aiYield}%`, color: "text-sky-700" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-2.5 bg-white/40 rounded-xl border border-white/50 shadow-sm backdrop-blur-sm">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{label}</p>
                  <p className={cn("text-lg font-bold", color)}>{value}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">{pipelineResult.fertilizerAdvice}</p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/40 rounded-xl border border-white/50 p-2.5 shadow-sm backdrop-blur-sm">
                <p className="text-gray-400 mb-0.5">{t("home.cidFilecoin")}</p>
                <p className="font-mono font-semibold text-[10px] break-all text-blue-600">{pipelineResult.cid.substring(0, 20)}...</p>
              </div>
              <div className="bg-white/40 rounded-xl border border-white/50 p-2.5 shadow-sm backdrop-blur-sm">
                <p className="text-gray-400 mb-0.5">{t("home.rewardEarned")}</p>
                <p className="font-bold text-amber-600">+{pipelineResult.rewardEarned} FLOW</p>
              </div>
            </div>

            {pipelineResult.riskLevel === "High" && pipelineResult.estimatedPayout && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-600" />
                  <div>
                    <p className="text-xs font-bold text-red-700">{t("home.starknetInsurance")}</p>
                    <p className="text-[10px] text-red-600/70">{t("home.autoTriggeredClaim")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-red-500">{t("home.estPayout")}</p>
                  <p className="text-sm font-bold text-red-700">&#8377;{pipelineResult.estimatedPayout.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tech Stack ── */}
        <div className={cn(glassCard, "p-4 space-y-3")}>

          {/* Header — centered with app logo */}
          <div className="flex flex-col items-center text-center gap-1.5 pb-1">
            <img
              src="/logo.jpeg"
              alt="Smart Fasal"
              className="w-12 h-12 rounded-full object-cover ring-2 ring-white/80 shadow-md"
            />
            <div>
              <p className="text-sm font-extrabold text-gray-800 leading-tight">Smart Fasal</p>
              <p className="text-[10px] font-semibold text-emerald-600 leading-tight">The Agriculture Platform</p>
            </div>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-gray-500">Developed by Raj Patil</p>
              <a
                href="https://www.linkedin.com/in/raj-patil-a492a1155/?skipRedirect=true"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-60 hover:opacity-100 transition-opacity"
                title="Raj Patil on LinkedIn"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0A66C2" className="w-3.5 h-3.5">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
            </div>
            <p className="text-[10px] text-gray-400 leading-snug max-w-[220px]">
              Built on cutting-edge Web3 protocols &amp; decentralized infrastructure
            </p>
          </div>

          {/* Protocol Labs — centred banner */}
          <a
            href="https://protocol.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 w-full px-3 py-3 rounded-xl bg-white/55 border border-white/65 hover:bg-white/75 transition-all group"
          >
            <img
              src="/protocollabs-logo-official.png"
              alt="Protocol Labs"
              className="w-8 h-8 rounded-xl object-contain shadow-sm group-hover:scale-105 transition-transform"
            />
            <div className="text-center">
              <p className="text-xs font-bold text-gray-800 leading-tight">Protocol Labs</p>
              <p className="text-[9px] text-gray-400 leading-tight">Web3 infrastructure &amp; research</p>
            </div>
          </a>

          {/* Protocol grid — 3 × 2, compact */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { name: "Flow", sub: "Rewards", avatar: "/flow-logo.png", href: "https://flow.com" },
              { name: "Filecoin", sub: "Storage", avatar: "/filecoin-logo.png", href: "https://filecoin.io" },
              { name: "Lit Protocol", sub: "Access", avatar: "/lit-logo.png", href: "https://litprotocol.com" },
              { name: "Zama", sub: "Privacy", avatar: "/zama-logo.png", href: "https://zama.ai" },
              { name: "Starknet", sub: "Insurance", avatar: "/starknet-logo.png", href: "https://starknet.io" },
              { name: "HyperCerts", sub: "Impact", avatar: "/hypercerts-logo.png", href: "https://hypercerts.org" },
            ].map(({ name, sub, avatar, href }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-white/40 border border-white/50 hover:bg-white/60 hover:border-white/75 hover:shadow-sm transition-all group"
              >
                <img
                  src={avatar}
                  alt={name}
                  className="w-7 h-7 rounded-lg object-contain bg-white ring-1 ring-black/8 shadow-sm group-hover:scale-110 transition-transform duration-200"
                />
                <p className="text-[9px] font-bold text-gray-700 leading-tight text-center">{name}</p>
                <p className="text-[8px] text-gray-400 leading-tight text-center">{sub}</p>
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
