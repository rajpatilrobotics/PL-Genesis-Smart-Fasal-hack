import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useGetAiRecommendation,
  useDetectDisease,
  useGetAiRecommendationHistory,
  getGetAiRecommendationHistoryQueryKey,
  useGetDiseaseHistory,
  getGetDiseaseHistoryQueryKey,
  useLitEncryptFarmData,
  type LitVaultRecord,
  useGetSensorHistory,
  getGetSensorHistoryQueryKey,
  useGetAnalyticsSummary,
  getGetAnalyticsSummaryQueryKey,
  useGetAnalyticsLogs,
  getGetAnalyticsLogsQueryKey,
} from "@workspace/api-client-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Brain, Zap, Sparkles, ChevronRight, Shield,
  Camera, Upload, X, Copy, ExternalLink, CheckCircle2,
  Loader2, FileImage, Database, History,
  Lock, ShieldCheck, Sprout, BarChart3, ShoppingCart,
  Activity, Droplets, FlaskConical, TrendingUp, Globe, Users, BookOpen,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet-context";
import { lighthouseUpload, lighthouseUploadFile } from "@/lib/lighthouse";
import { getEphemeralWallet } from "@/lib/lit";
import { cn } from "@/lib/utils";

type EvidenceRecord = {
  imageCid: string;
  imageUrl: string;
  reportCid: string;
  reportUrl: string;
  real: boolean;
  archivedAt: string;
};

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

type CatalogEntry = {
  id: number;
  datasetTitle: string;
  farmerWallet: string | null;
  location: string;
  device: string;
  recordCount: number;
  avgNitrogen: number;
  avgPhosphorus: number;
  avgPotassium: number;
  avgPh: number;
  avgMoisture: number;
  cid: string;
  ipfsUrl: string;
  isReal: string;
  accessCount: number;
  createdAt: string;
};

export default function AiHub() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { walletAddress, addFlowReward } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recForm, setRecForm] = useState({
    nitrogen: "120", phosphorus: "45", potassium: "180", ph: "6.5", moisture: "40"
  });
  const [litVaultSoilRecord, setLitVaultSoilRecord] = useState<LitVaultRecord | null>(null);
  const [cropPredicting, setCropPredicting] = useState(false);
  const [cropResult, setCropResult] = useState<CropPredictResult | null>(null);
  const [diseaseForm, setDiseaseForm] = useState({ cropName: "", imageDescription: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  const [copiedCid, setCopiedCid] = useState<string | null>(null);
  const [litVaultRecord, setLitVaultRecord] = useState<LitVaultRecord | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [myPublished, setMyPublished] = useState<CatalogEntry[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const getAiRec = useGetAiRecommendation();
  const detectDisease = useDetectDisease();
  const litEncryptMutation = useLitEncryptFarmData();

  const { data: recHistory } = useGetAiRecommendationHistory({
    query: { queryKey: getGetAiRecommendationHistoryQueryKey() }
  });
  const { data: diseaseHistory } = useGetDiseaseHistory({
    query: { queryKey: getGetDiseaseHistoryQueryKey() }
  });
  const { data: history, isLoading: loadingHistory } = useGetSensorHistory({ limit: 50 }, {
    query: { queryKey: getGetSensorHistoryQueryKey({ limit: 50 }) }
  });
  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary({
    query: { queryKey: getGetAnalyticsSummaryQueryKey() }
  });
  const { data: logs, isLoading: loadingLogs } = useGetAnalyticsLogs({}, {
    query: { queryKey: getGetAnalyticsLogsQueryKey({}) }
  });

  const chartData = history ? [...history].reverse() : [];
  const hasData = history && history.length > 0;
  const recordCount = history?.length ?? 0;

  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await fetch("/api/data-catalog");
      if (res.ok) setCatalog(await res.json());
    } catch { } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const sensorAvg = (key: "nitrogen" | "phosphorus" | "potassium" | "ph" | "moisture") =>
    hasData ? history!.reduce((s, r) => s + r[key], 0) / history!.length : 0;

  const handleRecSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    getAiRec.mutate({
      data: {
        nitrogen: Number(recForm.nitrogen),
        phosphorus: Number(recForm.phosphorus),
        potassium: Number(recForm.potassium),
        ph: Number(recForm.ph),
        moisture: Number(recForm.moisture)
      }
    }, {
      onSuccess: () => {
        toast({ title: t("ai.analysisComplete"), description: t("ai.aiRecommendation") + "." });
        queryClient.invalidateQueries({ queryKey: getGetAiRecommendationHistoryQueryKey() });
        if (walletAddress) addFlowReward("AI Crop Recommendation", 10);
      },
      onError: () => toast({ title: "Error", description: "Failed to get recommendation.", variant: "destructive" })
    });
  };

  const runCropPrediction = async () => {
    if (!hasData) {
      toast({ title: "No sensor data yet", description: "Go to Home and hover the LIVE badge to generate readings.", variant: "destructive" });
      return;
    }
    setCropPredicting(true);
    try {
      const res = await fetch("/api/crop-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avgNitrogen: sensorAvg("nitrogen"),
          avgPhosphorus: sensorAvg("phosphorus"),
          avgPotassium: sensorAvg("potassium"),
          avgPh: sensorAvg("ph"),
          avgMoisture: sensorAvg("moisture"),
          readingCount: history!.length,
          location: "Punjab, India",
        }),
      });
      if (!res.ok) throw new Error("failed");
      setCropResult(await res.json());
      if (walletAddress) addFlowReward("Sensor-based Crop Prediction", 8);
    } catch {
      toast({ title: "AI Error", description: "Could not get crop prediction. Try again.", variant: "destructive" });
    } finally {
      setCropPredicting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setEvidence(null);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setEvidence(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const [header, base64] = result.split(",");
        const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
        resolve({ base64, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const archiveEvidence = async (diagnosis: typeof detectDisease.data) => {
    if (!diagnosis) return;
    setArchiving(true);
    try {
      let imageCid = "";
      let imageUrl = "";
      let imageReal = false;
      if (imageFile) {
        const imgResult = await lighthouseUploadFile(imageFile);
        imageCid = imgResult.cid;
        imageUrl = imgResult.url;
        imageReal = imgResult.real;
      }
      const report = {
        type: "crop_disease_evidence",
        cropName: diseaseForm.cropName || diagnosis.plantName,
        symptoms: diseaseForm.imageDescription,
        diagnosis: {
          diseaseName: diagnosis.diseaseName,
          plantName: diagnosis.plantName,
          confidencePercent: diagnosis.confidencePercent,
          severity: diagnosis.severity,
          treatment: diagnosis.treatment,
        },
        photoIpfsCid: imageCid || null,
        farmer: walletAddress || "anonymous",
        timestamp: new Date().toISOString(),
        appVersion: "SmartFasal v1.0",
      };
      const reportResult = await lighthouseUpload("crop_disease_evidence", report);
      setEvidence({
        imageCid: imageCid || reportResult.cid,
        imageUrl: imageUrl || reportResult.url,
        reportCid: reportResult.cid,
        reportUrl: reportResult.url,
        real: imageReal || reportResult.real,
        archivedAt: new Date().toISOString(),
      });
      toast({
        title: reportResult.real ? "✅ Evidence Archived to Filecoin" : "Evidence Archived (Simulated)",
        description: "CID secured. Use it for insurance claims.",
      });
    } catch {
      toast({ title: "Archival failed", variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  };

  const handleDiseaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diseaseForm.imageDescription && !imageFile) {
      toast({ title: "Add a photo or describe symptoms", variant: "destructive" });
      return;
    }
    setEvidence(null);
    let imageBase64: string | null = null;
    let imageMimeType: string | null = null;
    if (imageFile) {
      try {
        const result = await fileToBase64(imageFile);
        imageBase64 = result.base64;
        imageMimeType = result.mimeType;
      } catch {
        toast({ title: "Failed to read image file", variant: "destructive" });
        return;
      }
    }
    detectDisease.mutate({
      data: { cropName: diseaseForm.cropName || null, imageDescription: diseaseForm.imageDescription || null, imageBase64, imageMimeType }
    }, {
      onSuccess: (data) => {
        toast({ title: t("ai.detectionComplete"), description: "Archiving to Filecoin..." });
        if (walletAddress) addFlowReward("Disease Detection Analysis", 10);
        queryClient.invalidateQueries({ queryKey: getGetDiseaseHistoryQueryKey() });
        archiveEvidence(data);
      },
      onError: () => toast({ title: "Error", description: "Failed to analyze.", variant: "destructive" })
    });
  };

  const handleEncryptDiseaseToVault = async (scanId?: number) => {
    const wallet = getEphemeralWallet();
    const farmerWallet = walletAddress || wallet.address;
    try {
      const record = await litEncryptMutation.mutateAsync({
        data: { farmerWallet, dataType: "disease-scan", scanId: scanId ?? null },
      });
      setLitVaultRecord(record);
      toast({
        title: "🔐 Encrypted & stored on Filecoin!",
        description: `AES-256-GCM secured. CID: ${record.filecoinCid?.slice(0, 14)}…`,
      });
    } catch (err) {
      toast({ title: "Encryption failed", description: String(err), variant: "destructive" });
    }
  };

  const handleEncryptSoilToVault = async () => {
    const wallet = getEphemeralWallet();
    const farmerWallet = walletAddress || wallet.address;
    try {
      const plaintext = JSON.stringify({
        type: "soil-analysis", farmer: farmerWallet,
        data: { nitrogen: Number(recForm.nitrogen), phosphorus: Number(recForm.phosphorus), potassium: Number(recForm.potassium), ph: Number(recForm.ph), moisture: Number(recForm.moisture), unit: "mg/kg" },
        aiResult: getAiRec.data ? { cropHealthPercent: getAiRec.data.cropHealthPercent, riskLevel: getAiRec.data.riskLevel } : null,
        timestamp: new Date().toISOString(),
        encryptedWith: "AES-256-GCM",
        accessControl: "Lit Protocol — wallet-signature gate",
      });
      const record = await litEncryptMutation.mutateAsync({ data: { farmerWallet, dataType: "soil-analysis", plaintext } });
      setLitVaultSoilRecord(record);
      toast({ title: "🔐 Soil analysis encrypted & on Filecoin!", description: `CID: ${record.filecoinCid?.slice(0, 14)}…` });
    } catch (err) {
      toast({ title: "Encryption failed", description: String(err), variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCid(label);
    setTimeout(() => setCopiedCid(null), 2000);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const handlePublishData = async () => {
    if (!hasData) {
      toast({ title: "No sensor data yet", description: "Go to Home and generate readings first.", variant: "destructive" });
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch("/api/data-catalog/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmerWallet: walletAddress ?? null,
          location: "Punjab, India",
          device: "ESP32-FARM-001",
          recordCount,
          avgNitrogen: sensorAvg("nitrogen"),
          avgPhosphorus: sensorAvg("phosphorus"),
          avgPotassium: sensorAvg("potassium"),
          avgPh: sensorAvg("ph"),
          avgMoisture: sensorAvg("moisture"),
        }),
      });
      if (!res.ok) throw new Error("publish failed");
      const entry: CatalogEntry = await res.json();
      setMyPublished(prev => [entry, ...prev]);
      await fetchCatalog();
      if (walletAddress) addFlowReward("Dataset published to Open Data Commons", 15);
      toast({
        title: entry.isReal === "true" ? "✅ Dataset live on IPFS/Filecoin" : "Dataset published to Open Data Commons",
        description: `CID: ${entry.cid.slice(0, 14)}… — anyone can verify this data`,
      });
    } catch {
      toast({ title: "Publish failed", description: "Could not upload dataset. Try again.", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const getLogColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "sensor": return "border-l-blue-400 bg-blue-400/10";
      case "ai": return "border-l-violet-400 bg-violet-400/10";
      case "insurance": return "border-l-amber-400 bg-amber-400/10";
      case "error": return "border-l-red-400 bg-red-400/10";
      default: return "border-l-gray-400 bg-gray-400/10";
    }
  };

  const diagnosisData = detectDisease.data;
  const isRunning = detectDisease.isPending || archiving;

  const glassCard = "glass-glow-violet rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl hover:bg-white/45";

  return (
    <div className="relative -mx-4 -mt-5 min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ background: "linear-gradient(165deg, #f5f3ff 0%, #ede9fe 28%, #faf5ff 60%, #f0f9ff 100%)" }}>

      {/* Violet blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-violet-300/40 blur-3xl" />
        <div className="absolute top-1/4 -left-16 w-60 h-60 rounded-full bg-purple-200/35 blur-3xl" />
        <div className="absolute top-2/3 right-0 w-56 h-56 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-fuchsia-200/25 blur-2xl" />
      </div>

      <div className="relative space-y-4 px-4 pt-5 pb-28">

        {/* ── Hero Header ── */}
        <div className="relative rounded-2xl overflow-hidden p-4 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-500/30 active:translate-y-0"
          style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 45%, #5b21b6 100%)", border: "1px solid rgba(255,255,255,0.35)" }}>
          <div className="absolute -top-4 -right-4 w-36 h-36 rounded-full bg-fuchsia-300/20 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-28 h-16 rounded-full bg-indigo-300/20 blur-xl" />
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">{t("ai.title")}</h2>
              </div>
              <p className="text-violet-100/80 text-xs mt-0.5 font-medium">AI Insights · Sensor Analytics · Data Marketplace</p>
            </div>
            {walletAddress && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-300/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
                <Zap className="w-3.5 h-3.5" />
                +10 FLOW / analysis
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="crop-ai" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-2 bg-white/50 backdrop-blur-sm border border-white/60">
            <TabsTrigger value="crop-ai" className="text-[11px] px-1">
              <Brain className="w-3.5 h-3.5 mr-1 shrink-0" />Crop AI
            </TabsTrigger>
            <TabsTrigger value="disease" className="text-[11px] px-1">
              <Camera className="w-3.5 h-3.5 mr-1 shrink-0" />Disease
            </TabsTrigger>
            <TabsTrigger value="charts" className="text-[11px] px-1">
              <BarChart3 className="w-3.5 h-3.5 mr-1 shrink-0" />Charts
            </TabsTrigger>
            <TabsTrigger value="market" className="text-[11px] px-1">
              <ShoppingCart className="w-3.5 h-3.5 mr-1 shrink-0" />Market
            </TabsTrigger>
          </TabsList>

          {/* ══ TAB 1 — CROP AI ══ */}
          <TabsContent value="crop-ai" className="space-y-4 mt-3">

            {/* Sensor-auto prediction — emerald accent card */}
            <div className="relative rounded-2xl overflow-hidden shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/25 active:translate-y-0"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)", border: "1px solid rgba(255,255,255,0.30)" }}>
              <div className="absolute -top-3 -right-3 w-20 h-20 rounded-full bg-white/15 blur-2xl" />
              <div className="absolute inset-0 opacity-[0.04]"
                style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
              <div className="relative p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Sprout className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">Predict from Live Sensors</p>
                    <p className="text-xs text-emerald-100/80">Auto-uses {recordCount} IoT readings from ESP32-FARM-001</p>
                  </div>
                </div>

                {hasData && (
                  <div className="grid grid-cols-5 gap-1 mb-3">
                    {[
                      { label: "N", value: sensorAvg("nitrogen").toFixed(0) },
                      { label: "P", value: sensorAvg("phosphorus").toFixed(0) },
                      { label: "K", value: sensorAvg("potassium").toFixed(0) },
                      { label: "pH", value: sensorAvg("ph").toFixed(1) },
                      { label: "H₂O", value: sensorAvg("moisture").toFixed(0) + "%" },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white/20 backdrop-blur-sm rounded-lg p-1.5 text-center">
                        <p className="text-[10px] font-semibold text-emerald-100">{label}</p>
                        <p className="text-xs font-bold text-white leading-tight">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={runCropPrediction} disabled={cropPredicting || !hasData}
                  className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm" size="sm">
                  {cropPredicting
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Analysing soil...</>
                    : <><Sprout className="w-3.5 h-3.5 mr-1.5" />Predict Best Crops {walletAddress && <span className="ml-1 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">+8 FLOW</span>}</>
                  }
                </Button>
                {!hasData && <p className="text-[10px] text-center text-emerald-100/70 mt-1.5">Go to Home → hover LIVE badge to generate sensor data first</p>}
              </div>
            </div>

            {/* Crop prediction results */}
            {cropResult && (
              <div className="space-y-3">
                <div className={cn(glassCard, "p-3 border-amber-200/50 bg-amber-50/35")}>
                  <p className="text-[11px] text-amber-900 leading-relaxed">{cropResult.insight}</p>
                </div>
                {cropResult.crops.map((crop, idx) => (
                  <div key={crop.name} className={cn(glassCard, "p-3", idx === 0 ? "border-emerald-300/60 bg-emerald-50/35" : "")}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{crop.emoji}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-gray-800">{crop.name}</p>
                            {idx === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white">TOP PICK</span>}
                          </div>
                          <p className="text-[10px] text-gray-500">{crop.season}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-emerald-700">{crop.confidence}%</p>
                    </div>
                    <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-2">
                      <div className={cn("h-full rounded-full", idx === 0 ? "bg-gradient-to-r from-emerald-400 to-green-600" : "bg-gradient-to-r from-violet-400 to-purple-600")}
                        style={{ width: `${crop.confidence}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      {[
                        { label: "Yield", val: crop.expectedYield },
                        { label: "Water", val: crop.waterRequirement },
                        { label: "Days", val: `${crop.growthDays}d` },
                      ].map(({ label, val }) => (
                        <div key={label} className="text-center bg-white/25 backdrop-blur-sm rounded-lg p-1">
                          <p className="text-[9px] text-gray-500">{label}</p>
                          <p className="text-[11px] font-semibold text-gray-800">{val}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">{crop.reasoning}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-white/40" />
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">or manual input</span>
              <div className="flex-1 h-px bg-white/40" />
            </div>

            {/* Manual soil input */}
            <div className={cn(glassCard, "p-4")}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Manual Soil Analysis</p>
                  <p className="text-[11px] text-gray-500">Enter custom NPK values for targeted advice</p>
                </div>
              </div>
              <form onSubmit={handleRecSubmit} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "n", label: "N (mg/kg)", key: "nitrogen" },
                    { id: "p", label: "P (mg/kg)", key: "phosphorus" },
                    { id: "k", label: "K (mg/kg)", key: "potassium" },
                  ].map(f => (
                    <div key={f.id} className="space-y-1">
                      <Label htmlFor={f.id} className="text-xs text-gray-600">{f.label}</Label>
                      <Input id={f.id} value={recForm[f.key as keyof typeof recForm]}
                        onChange={e => setRecForm({ ...recForm, [f.key]: e.target.value })}
                        type="number" required className="h-8 text-sm bg-white/60 border-white/60" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="ph" className="text-xs text-gray-600">pH Level</Label>
                    <Input id="ph" value={recForm.ph} onChange={e => setRecForm({ ...recForm, ph: e.target.value })} type="number" step="0.1" required className="h-8 text-sm bg-white/60 border-white/60" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="moisture" className="text-xs text-gray-600">Moisture %</Label>
                    <Input id="moisture" value={recForm.moisture} onChange={e => setRecForm({ ...recForm, moisture: e.target.value })} type="number" required className="h-8 text-sm bg-white/60 border-white/60" />
                  </div>
                </div>
                <Button type="submit" className="w-full relative bg-violet-600 hover:bg-violet-700 text-white" size="sm" disabled={getAiRec.isPending}>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  {getAiRec.isPending ? t("ai.analyzing") : t("ai.generateInsights")}
                  {walletAddress && <span className="absolute right-3 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">+10 FLOW</span>}
                </Button>
              </form>
            </div>

            {/* Manual AI results */}
            {getAiRec.data && (
              <div className={cn(glassCard, "p-4 border-violet-300/50 bg-violet-50/35")}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Brain className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                  <p className="text-sm font-bold text-violet-800">{t("ai.aiRecommendationTitle")}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "Health", value: `${getAiRec.data.cropHealthPercent}%`, color: "text-emerald-700" },
                    { label: "Risk", value: getAiRec.data.riskLevel, color: getAiRec.data.riskLevel === "LOW" ? "text-emerald-600" : getAiRec.data.riskLevel === "MEDIUM" ? "text-amber-600" : "text-red-600" },
                    { label: "Yield", value: `${getAiRec.data.yieldPercent}%`, color: "text-violet-700" },
                  ].map(item => (
                    <div key={item.label} className="bg-white/50 backdrop-blur-sm p-2 rounded-xl text-center">
                      <p className="text-[10px] uppercase text-gray-400 font-bold">{item.label}</p>
                      <p className={cn("font-bold text-base", item.color)}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { label: t("ai.fertilizerLabel"), color: "text-violet-700", value: getAiRec.data.fertilizerAdvice },
                    { label: t("ai.irrigationLabel"), color: "text-blue-600", value: getAiRec.data.irrigationSuggestion },
                    { label: t("ai.riskAnalysisLabel"), color: "text-amber-600", value: getAiRec.data.riskAnalysis },
                  ].map(item => (
                    <div key={item.label} className="p-2.5 bg-white/50 backdrop-blur-sm rounded-xl border border-white/60">
                      <p className={cn("font-semibold mb-0.5 text-xs", item.color)}>{item.label}</p>
                      <p className="text-gray-600 leading-relaxed">{item.value}</p>
                    </div>
                  ))}
                </div>
                {/* Lit Vault */}
                <div className="mt-3 border border-orange-300/60 bg-orange-50/50 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-orange-600" />
                    <p className="text-xs font-bold text-orange-800">{t("ai.storePrivateVault")}</p>
                  </div>
                  {litVaultSoilRecord ? (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-2 space-y-1">
                      <div className="flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
                        <ShieldCheck className="w-3 h-3" />{t("ai.soilDataEncrypted")}
                      </div>
                      <code className="text-[10px] font-mono text-emerald-800 block truncate">{litVaultSoilRecord.filecoinCid}</code>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full border-orange-400 text-orange-700 hover:bg-orange-100 h-7 text-[11px]" onClick={handleEncryptSoilToVault} disabled={litEncryptMutation.isPending}>
                      {litEncryptMutation.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Encrypting…</> : <><Lock className="w-3 h-3 mr-1" />Encrypt to Lit Vault + Filecoin</>}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Rec history */}
            {recHistory && recHistory.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-sm px-1 flex items-center gap-1.5 text-gray-700">
                  <History className="w-3.5 h-3.5 text-violet-500" />{t("ai.pastRecommendations")}
                </p>
                {recHistory.slice(0, 3).map((rec: any) => (
                  <div key={rec.id} className={cn(glassCard, "p-3 flex items-center justify-between cursor-pointer")}>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Health: {rec.cropHealthPercent}%</p>
                      <p className="text-xs text-gray-500">{new Date(rec.createdAt).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-violet-400" />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ══ TAB 2 — DISEASE SCANNER ══ */}
          <TabsContent value="disease" className="space-y-4 mt-3">
            <div className={cn(glassCard, "flex items-center gap-2 p-3 border-blue-200/50 bg-blue-50/35")}>
              <Shield className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs text-blue-800">Photos & diagnosis auto-archived to <strong>Filecoin/IPFS</strong> as tamper-proof insurance evidence</span>
            </div>

            {/* Disease scanner form */}
            <div className={cn(glassCard, "p-4")}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Camera className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">Crop Disease Scanner</p>
                  <p className="text-[11px] text-gray-500">Upload a photo — AI diagnoses & archives as evidence</p>
                </div>
              </div>
              <form onSubmit={handleDiseaseSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600">Crop Photo (Evidence)</Label>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                  {!imagePreview ? (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-violet-200/70 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-violet-400 hover:bg-violet-50/50 transition-all text-gray-500">
                      <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                        <FileImage className="w-5 h-5 text-violet-500" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-sm text-gray-700">Upload crop photo</p>
                        <p className="text-xs text-gray-400">Tap to open camera or gallery</p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                        <Database className="w-3 h-3" />Will archive to IPFS as evidence
                      </div>
                    </button>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-white/60">
                      <img src={imagePreview} alt="Crop" className="w-full h-44 object-cover" />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-black/60 text-white rounded-full p-1.5"><Upload className="w-3 h-3" /></button>
                        <button type="button" onClick={clearImage} className="bg-black/60 text-white rounded-full p-1.5"><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="crop" className="text-xs text-gray-600">Crop Name (Optional)</Label>
                  <Input id="crop" placeholder="e.g. Wheat, Tomato, Rice" value={diseaseForm.cropName} onChange={e => setDiseaseForm({ ...diseaseForm, cropName: e.target.value })} className="h-8 text-sm bg-white/60 border-white/60" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="symptoms" className="text-xs text-gray-600">Symptoms <span className="text-gray-400">(optional if photo provided)</span></Label>
                  <Textarea id="symptoms" placeholder="e.g. Yellowing leaves with brown spots..." rows={2} value={diseaseForm.imageDescription} onChange={e => setDiseaseForm({ ...diseaseForm, imageDescription: e.target.value })} className="text-sm bg-white/60 border-white/60" />
                </div>
                <Button type="submit" className="w-full relative bg-violet-600 hover:bg-violet-700 text-white" size="sm" disabled={isRunning}>
                  {isRunning
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{archiving ? "Archiving to IPFS..." : t("ai.analyzing")}</>
                    : <><Camera className="w-3.5 h-3.5 mr-1.5" />{t("ai.analyzeDisease")} {walletAddress && <span className="absolute right-3 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">+10 FLOW</span>}</>
                  }
                </Button>
              </form>
            </div>

            {/* Disease result */}
            {diagnosisData && (
              <div className={cn(glassCard, "p-4 border-red-200/50 bg-red-50/20")}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-gray-800">{t("ai.diseaseDetected")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/50 backdrop-blur-sm p-2 rounded-xl text-center">
                    <p className="text-[10px] uppercase text-gray-400 font-bold">Disease</p>
                    <p className="font-bold text-sm text-red-600 truncate">{diagnosisData.diseaseName}</p>
                  </div>
                  <div className="bg-white/50 backdrop-blur-sm p-2 rounded-xl text-center">
                    <p className="text-[10px] uppercase text-gray-400 font-bold">Confidence</p>
                    <p className="font-bold text-sm text-gray-800">{diagnosisData.confidencePercent}%</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { label: "Plant", value: diagnosisData.plantName },
                    { label: "Severity", value: diagnosisData.severity },
                    { label: "Treatment", value: diagnosisData.treatment },
                  ].map(item => (
                    <div key={item.label} className="p-2.5 bg-white/50 backdrop-blur-sm rounded-xl border border-white/60">
                      <p className="font-semibold mb-0.5 text-gray-700">{item.label}</p>
                      <p className="text-gray-600">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* IPFS Evidence */}
                {evidence && (
                  <div className="mt-3 bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                      <Database className="w-3 h-3" />Evidence Archived to Filecoin/IPFS
                    </div>
                    {[
                      { label: "Report CID", cid: evidence.reportCid, url: evidence.reportUrl },
                      ...(evidence.imageCid !== evidence.reportCid ? [{ label: "Photo CID", cid: evidence.imageCid, url: evidence.imageUrl }] : []),
                    ].map(({ label, cid, url }) => (
                      <div key={label} className="space-y-0.5">
                        <p className="text-[10px] text-gray-500 font-medium">{label}</p>
                        <div className="flex items-center gap-1.5">
                          <code className="text-[10px] font-mono text-emerald-800 flex-1 truncate">{cid}</code>
                          <button onClick={() => copyToClipboard(cid, label)} className="text-emerald-600">
                            {copiedCid === label ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500"><ExternalLink className="w-3 h-3" /></a>
                        </div>
                      </div>
                    ))}
                    <div className={cn("text-[10px] px-1.5 py-0.5 rounded w-fit font-medium", evidence.real ? "bg-emerald-200 text-emerald-800" : "bg-amber-100 text-amber-700")}>
                      {evidence.real ? "✅ Real Filecoin CID" : "⚡ Simulated (IPFS offline)"}
                    </div>
                  </div>
                )}

                {/* Lit Vault */}
                <div className="mt-3 border border-orange-300/60 bg-orange-50/50 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-orange-600" />
                    <p className="text-xs font-bold text-orange-800">Encrypt to Private Vault</p>
                  </div>
                  {litVaultRecord ? (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-2 space-y-1">
                      <div className="flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
                        <ShieldCheck className="w-3 h-3" />Encrypted on Filecoin
                      </div>
                      <code className="text-[10px] font-mono text-emerald-800 block truncate">{litVaultRecord.filecoinCid}</code>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full border-orange-400 text-orange-700 hover:bg-orange-100 h-7 text-[11px]" onClick={() => handleEncryptDiseaseToVault()} disabled={litEncryptMutation.isPending}>
                      {litEncryptMutation.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Encrypting…</> : <><Lock className="w-3 h-3 mr-1" />Encrypt to Lit Vault + Filecoin</>}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Disease history */}
            {diseaseHistory && diseaseHistory.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-sm px-1 flex items-center gap-1.5 text-gray-700">
                  <History className="w-3.5 h-3.5 text-violet-500" />{t("ai.scanHistory")}
                </p>
                {diseaseHistory.slice(0, 3).map((scan: any) => (
                  <div key={scan.id} className={cn(glassCard, "p-3")}>
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-gray-800">{scan.diseaseName}</p>
                        <p className="text-xs text-gray-500">{scan.plantName} · {scan.confidencePercent}% confidence</p>
                        <p className="text-xs text-gray-400">{new Date(scan.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", scan.severity === "LOW" ? "bg-emerald-100 text-emerald-700" : scan.severity === "HIGH" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                        {scan.severity}
                      </div>
                    </div>
                    {scan.filecoinCid && (
                      <button onClick={() => handleEncryptDiseaseToVault(scan.id)} className="mt-2 flex items-center gap-1 text-[10px] text-orange-600 font-medium hover:text-orange-800">
                        <Lock className="w-3 h-3" />Encrypt this scan to vault
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ══ TAB 3 — CHARTS & ANALYTICS ══ */}
          <TabsContent value="charts" className="space-y-4 mt-3">

            {/* Violet analytics summary accent card */}
            <div className="relative rounded-2xl overflow-hidden shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-500/25 active:translate-y-0"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)", border: "1px solid rgba(255,255,255,0.25)" }}>
              <div className="absolute -top-3 -right-3 w-20 h-20 rounded-full bg-white/10 blur-2xl" />
              <div className="relative p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className="text-sm font-bold text-white">Analytics Overview</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Readings", value: loadingSummary ? "-" : String(summary?.totalSensorReadings ?? 0) },
                    { label: "Avg Health", value: loadingSummary ? "-" : `${summary?.avgCropHealth != null ? Math.round(summary.avgCropHealth) : 0}%` },
                    { label: "Avg pH", value: loadingSummary ? "-" : summary?.avgSoilPh != null ? Number(summary.avgSoilPh).toFixed(1) : "-" },
                    { label: "Moisture", value: loadingSummary ? "-" : `${summary?.avgMoisture != null ? Math.round(summary.avgMoisture) : 0}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/20 backdrop-blur-sm rounded-xl p-2 text-center">
                      <p className="text-base font-bold text-white">{value}</p>
                      <p className="text-[9px] text-violet-100/80">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* NPK Chart */}
            <div className={cn(glassCard, "p-4")}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">NPK Trends</p>
                  <p className="text-[11px] text-gray-500">Nitrogen · Phosphorus · Potassium (mg/kg)</p>
                </div>
              </div>
              <div className="h-[180px] w-full">
                {loadingHistory ? <Skeleton className="w-full h-full" /> : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                      <XAxis dataKey="createdAt" tickFormatter={t => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "rgba(255,255,255,0.95)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "12px", fontSize: 11, backdropFilter: "blur(8px)" }} labelFormatter={l => new Date(l).toLocaleString()} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="nitrogen" name="N" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="phosphorus" name="P" stroke="#f97316" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="potassium" name="K" stroke="#a855f7" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-sm text-gray-400">No data yet — trigger LIVE sensor on Home page</div>}
              </div>
            </div>

            {/* pH + Moisture Chart */}
            <div className={cn(glassCard, "p-4")}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">pH & Moisture Trends</p>
                  <p className="text-[11px] text-gray-500">Soil pH · Moisture %</p>
                </div>
              </div>
              <div className="h-[180px] w-full">
                {loadingHistory ? <Skeleton className="w-full h-full" /> : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                      <XAxis dataKey="createdAt" tickFormatter={t => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "rgba(255,255,255,0.95)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: "12px", fontSize: 11, backdropFilter: "blur(8px)" }} labelFormatter={l => new Date(l).toLocaleString()} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="ph" name="pH" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="moisture" name="Moisture%" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-sm text-gray-400">No data yet — trigger LIVE sensor on Home page</div>}
              </div>
            </div>

            {/* Activity Log */}
            {logs && logs.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-700 px-1 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-violet-500" />Activity Log
                </p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {logs.slice(0, 10).map((log: any) => (
                    <div key={log.id}
                      className={cn("border-l-2 pl-3 py-1.5 rounded-r-xl text-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm", getLogColor(log.eventType))}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-700">{log.eventType}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {log.details && <p className="text-gray-500 mt-0.5 leading-tight truncate">{typeof log.details === "string" ? log.details : JSON.stringify(log.details)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ══ TAB 4 — DATA COMMONS / MARKET ══ */}
          <TabsContent value="market" className="space-y-4 mt-3">

            {/* Publish card — violet accent */}
            <div className="relative rounded-2xl overflow-hidden shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-violet-500/25 active:translate-y-0"
              style={{ background: "linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #8b5cf6 100%)", border: "1px solid rgba(255,255,255,0.25)" }}>
              <div className="absolute -top-3 -right-3 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute inset-0 opacity-[0.04]"
                style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
              <div className="relative p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Database className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white">Publish to Open Data Commons</p>
                    <p className="text-xs text-violet-100/80 mt-0.5">Share {recordCount} sensor readings · earn +15 FLOW</p>
                  </div>
                </div>
                <Button onClick={handlePublishData} disabled={publishing || !hasData}
                  className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm" size="sm">
                  {publishing
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Publishing…</>
                    : <><Globe className="w-3.5 h-3.5 mr-1.5" />Publish Dataset {walletAddress && <span className="ml-1 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">+15 FLOW</span>}</>
                  }
                </Button>
                {!hasData && <p className="text-[10px] text-center text-violet-100/70 mt-1.5">Generate sensor readings first from the Home page</p>}
              </div>
            </div>

            {/* My published datasets */}
            {myPublished.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-1.5 text-gray-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> My Published Datasets
                </p>
                {myPublished.map(entry => (
                  <div key={entry.id} className={cn(glassCard, "p-3 border-emerald-200/50 bg-emerald-50/25")}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-tight truncate text-gray-800">{entry.datasetTitle}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{entry.recordCount} readings · {entry.location}</p>
                      </div>
                      {entry.isReal === "true" ? (
                        <span className="shrink-0 text-[9px] bg-emerald-600 text-white rounded-full px-2 py-0.5 font-semibold">LIVE ON IPFS</span>
                      ) : (
                        <span className="shrink-0 text-[9px] bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 font-semibold">IPFS HASH</span>
                      )}
                    </div>
                    <div className="bg-white/60 rounded-xl p-2 space-y-1">
                      <p className="text-[10px] font-semibold text-gray-400">Content ID (CID)</p>
                      <div className="flex items-center gap-1.5">
                        <code className="text-[10px] font-mono text-violet-800 flex-1 truncate">{entry.cid}</code>
                        <button onClick={() => { navigator.clipboard.writeText(entry.cid); toast({ title: "CID copied!" }); }} className="shrink-0 text-gray-400 hover:text-gray-700">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <a href={entry.ipfsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                        <ExternalLink className="w-2.5 h-2.5" /> View on IPFS Gateway
                      </a>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-700 mt-2">
                      <CheckCircle2 className="w-3 h-3" />
                      Permanently stored · CC BY 4.0 · Anyone can cite this CID
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Platform-wide data registry */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-1.5 text-gray-700">
                  <BookOpen className="w-3.5 h-3.5 text-violet-600" /> Community Data Registry
                </p>
                <button onClick={fetchCatalog} className="text-[10px] text-gray-400 hover:text-gray-700 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Refresh
                </button>
              </div>
              <p className="text-[11px] text-gray-500">Soil datasets contributed by farmers — each CID is verifiable on IPFS</p>

              {catalogLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-2xl" />
                  <Skeleton className="h-16 w-full rounded-2xl" />
                </div>
              ) : catalog.length === 0 ? (
                <div className={cn(glassCard, "p-4 text-center")}>
                  <Database className="w-8 h-8 mx-auto text-violet-300 mb-2" />
                  <p className="text-sm text-gray-500">No datasets yet</p>
                  <p className="text-[11px] text-gray-400">Be the first to publish your soil data to the commons</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Datasets", value: catalog.length },
                      { label: "Readings", value: catalog.reduce((s, e) => s + e.recordCount, 0).toLocaleString("en-IN") },
                      { label: "Accesses", value: catalog.reduce((s, e) => s + e.accessCount, 0) },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-violet-50/60 border border-violet-100/60 rounded-xl p-2 text-center backdrop-blur-sm">
                        <p className="text-base font-bold text-violet-700">{value}</p>
                        <p className="text-[10px] text-gray-500">{label}</p>
                      </div>
                    ))}
                  </div>

                  {catalog.map(entry => (
                    <div key={entry.id} className={cn(glassCard, "p-3")}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold leading-tight text-gray-800">{entry.datasetTitle}</p>
                          <p className="text-[10px] text-gray-500">{entry.recordCount} readings · {entry.location} · {new Date(entry.createdAt).toLocaleDateString("en-IN")}</p>
                        </div>
                        {entry.isReal === "true" ? (
                          <span className="shrink-0 text-[9px] bg-emerald-600 text-white rounded-full px-2 py-0.5 font-semibold">LIVE</span>
                        ) : (
                          <span className="shrink-0 text-[9px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">IPFS</span>
                        )}
                      </div>

                      {/* NPK mini bars */}
                      <div className="grid grid-cols-3 gap-1 mb-2">
                        {[
                          { label: "N", value: entry.avgNitrogen.toFixed(0), color: "bg-gradient-to-r from-emerald-400 to-green-500", max: 300 },
                          { label: "P", value: entry.avgPhosphorus.toFixed(0), color: "bg-gradient-to-r from-orange-400 to-amber-500", max: 150 },
                          { label: "K", value: entry.avgPotassium.toFixed(0), color: "bg-gradient-to-r from-purple-400 to-violet-500", max: 400 },
                        ].map(({ label, value, color, max }) => (
                          <div key={label}>
                            <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                              <span>{label}</span><span>{value}</span>
                            </div>
                            <div className="h-1 bg-white/60 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, (parseFloat(value) / max) * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <code className="text-[9px] font-mono text-gray-400">{entry.cid.slice(0, 12)}…{entry.cid.slice(-6)}</code>
                        <a
                          href={entry.ipfsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={async () => {
                            try { await fetch(`/api/data-catalog/${entry.id}/access`, { method: "POST" }); } catch {}
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> Open
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Why this matters callout */}
            <div className={cn(glassCard, "p-3 border-blue-200/50 bg-blue-50/25")}>
              <div className="flex gap-2">
                <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-900">Why this matters</p>
                  <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                    Each published dataset gets a permanent IPFS CID — a cryptographic fingerprint that makes the data verifiable forever. Research institutions like ICAR and CGIAR use CID-referenced open datasets for soil science. Your data, cited by researchers, traceable back to you.
                  </p>
                </div>
              </div>
            </div>

          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
