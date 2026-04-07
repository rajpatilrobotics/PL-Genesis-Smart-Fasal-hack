import { useState, useRef, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

// ─── Shared Types ─────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AiHub() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { walletAddress, addFlowReward } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── AI Recommendations state ──
  const [recForm, setRecForm] = useState({
    nitrogen: "120", phosphorus: "45", potassium: "180", ph: "6.5", moisture: "40"
  });
  const [litVaultSoilRecord, setLitVaultSoilRecord] = useState<LitVaultRecord | null>(null);

  // ── Crop AI (sensor-based) state ──
  const [cropPredicting, setCropPredicting] = useState(false);
  const [cropResult, setCropResult] = useState<CropPredictResult | null>(null);

  // ── Disease state ──
  const [diseaseForm, setDiseaseForm] = useState({ cropName: "", imageDescription: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  const [copiedCid, setCopiedCid] = useState<string | null>(null);
  const [litVaultRecord, setLitVaultRecord] = useState<LitVaultRecord | null>(null);

  // ── Data Commons state ──
  const [publishing, setPublishing] = useState(false);
  const [myPublished, setMyPublished] = useState<CatalogEntry[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // ── API hooks ──
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
      const res = await fetch(apiUrl("/api/data-catalog"));
      if (res.ok) setCatalog(await res.json());
    } catch { } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const sensorAvg = (key: "nitrogen" | "phosphorus" | "potassium" | "ph" | "moisture") =>
    hasData ? history!.reduce((s, r) => s + r[key], 0) / history!.length : 0;

  // ── Handlers ──

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
      const res = await fetch(apiUrl("/api/crop-predict"), {
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
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1024;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
            else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          const [, base64] = compressed.split(",");
          resolve({ base64, mimeType: "image/jpeg" });
        };
        img.onerror = reject;
        img.src = dataUrl;
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
        title: "✅ Evidence Archived to Filecoin",
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
      const res = await fetch(apiUrl("/api/data-catalog/publish"), {
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
      case "sensor": return "border-l-blue-500 bg-blue-500/5";
      case "ai": return "border-l-green-500 bg-green-500/5";
      case "insurance": return "border-l-yellow-500 bg-yellow-500/5";
      case "error": return "border-l-red-500 bg-red-500/5";
      default: return "border-l-gray-500 bg-gray-500/5";
    }
  };


  const diagnosisData = detectDisease.data;
  const isRunning = detectDisease.isPending || archiving;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-4 shadow-lg">
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 blur-xl" />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-indigo-400/20 blur-lg" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">{t("ai.title")}</h2>
            </div>
            <p className="text-violet-100/70 text-xs mt-0.5">AI Insights · Sensor Analytics · Data Marketplace</p>
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
        <TabsList className="grid w-full grid-cols-4 mb-2">
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

        {/* ══════════════════════════════════════════════════════════
            TAB 1 — CROP AI
            (Manual soil input + Sensor-auto prediction)
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="crop-ai" className="space-y-4 mt-3">

          {/* ── Sensor-auto prediction ── */}
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                  <Sprout className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Predict from Live Sensors</p>
                  <p className="text-xs text-muted-foreground">Auto-uses {recordCount} IoT readings from ESP32-FARM-001</p>
                </div>
              </div>

              {hasData && (
                <div className="grid grid-cols-5 gap-1 mb-3">
                  {[
                    { label: "N", value: sensorAvg("nitrogen").toFixed(0), color: "text-green-700 bg-green-100" },
                    { label: "P", value: sensorAvg("phosphorus").toFixed(0), color: "text-orange-700 bg-orange-100" },
                    { label: "K", value: sensorAvg("potassium").toFixed(0), color: "text-purple-700 bg-purple-100" },
                    { label: "pH", value: sensorAvg("ph").toFixed(1), color: "text-blue-700 bg-blue-100" },
                    { label: "H₂O", value: sensorAvg("moisture").toFixed(0) + "%", color: "text-cyan-700 bg-cyan-100" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={cn("rounded-lg p-1.5 text-center", color)}>
                      <p className="text-[10px] font-semibold">{label}</p>
                      <p className="text-xs font-bold leading-tight">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={runCropPrediction} disabled={cropPredicting || !hasData} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" size="sm">
                {cropPredicting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Analysing soil...</> : <><Sprout className="w-3.5 h-3.5 mr-1.5" />Predict Best Crops {walletAddress && <span className="ml-1 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">+8 FLOW</span>}</>}
              </Button>
              {!hasData && <p className="text-[10px] text-center text-muted-foreground mt-1.5">Go to Home → hover LIVE badge to generate sensor data first</p>}
            </CardContent>
          </Card>

          {/* Crop prediction results */}
          {cropResult && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-[11px] text-amber-900 leading-relaxed">{cropResult.insight}</p>
              </div>
              {cropResult.crops.map((crop, idx) => (
                <Card key={crop.name} className={cn("border", idx === 0 ? "border-emerald-200 bg-emerald-50/30" : "")}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{crop.emoji}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold">{crop.name}</p>
                            {idx === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white">TOP PICK</span>}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{crop.season}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-emerald-700">{crop.confidence}%</p>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                      <div className={cn("h-full rounded-full", idx === 0 ? "bg-emerald-500" : "bg-primary/70")} style={{ width: `${crop.confidence}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      {[
                        { label: "Yield", val: crop.expectedYield },
                        { label: "Water", val: crop.waterRequirement },
                        { label: "Days", val: `${crop.growthDays}d` },
                      ].map(({ label, val }) => (
                        <div key={label} className="text-center bg-muted/50 rounded p-1">
                          <p className="text-[9px] text-muted-foreground">{label}</p>
                          <p className="text-[11px] font-semibold">{val}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{crop.reasoning}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ── Divider ── */}
          <div className="flex items-center gap-2 py-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">or manual input</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* ── Manual soil input ── */}
          <Card>
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Manual Soil Analysis
              </CardTitle>
              <CardDescription className="text-xs">Enter custom NPK values for targeted advice</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRecSubmit} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "n", label: "N (mg/kg)", key: "nitrogen" },
                    { id: "p", label: "P (mg/kg)", key: "phosphorus" },
                    { id: "k", label: "K (mg/kg)", key: "potassium" },
                  ].map(f => (
                    <div key={f.id} className="space-y-1">
                      <Label htmlFor={f.id} className="text-xs">{f.label}</Label>
                      <Input id={f.id} value={recForm[f.key as keyof typeof recForm]}
                        onChange={e => setRecForm({ ...recForm, [f.key]: e.target.value })} type="number" required className="h-8 text-sm" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="ph" className="text-xs">pH Level</Label>
                    <Input id="ph" value={recForm.ph} onChange={e => setRecForm({ ...recForm, ph: e.target.value })} type="number" step="0.1" required className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="moisture" className="text-xs">Moisture %</Label>
                    <Input id="moisture" value={recForm.moisture} onChange={e => setRecForm({ ...recForm, moisture: e.target.value })} type="number" required className="h-8 text-sm" />
                  </div>
                </div>
                <Button type="submit" className="w-full relative" size="sm" disabled={getAiRec.isPending}>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  {getAiRec.isPending ? t("ai.analyzing") : t("ai.generateInsights")}
                  {walletAddress && <span className="absolute right-3 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">+10 FLOW</span>}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Manual AI results */}
          {getAiRec.data && (
            <Card className="border-primary bg-primary/5">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm text-primary flex items-center gap-1.5">
                  <Brain className="w-4 h-4" /> {t("ai.aiRecommendationTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Health", value: `${getAiRec.data.cropHealthPercent}%` },
                    { label: "Risk", value: getAiRec.data.riskLevel, color: getAiRec.data.riskLevel === "LOW" ? "text-green-600" : getAiRec.data.riskLevel === "MEDIUM" ? "text-yellow-600" : "text-red-600" },
                    { label: "Yield", value: `${getAiRec.data.yieldPercent}%` },
                  ].map(item => (
                    <div key={item.label} className="bg-background p-2 rounded-lg text-center shadow-sm">
                      <p className="text-[10px] uppercase text-muted-foreground font-bold">{item.label}</p>
                      <p className={cn("font-bold text-base", item.color)}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { label: t("ai.fertilizerLabel"), color: "text-primary", value: getAiRec.data.fertilizerAdvice },
                    { label: t("ai.irrigationLabel"), color: "text-blue-600", value: getAiRec.data.irrigationSuggestion },
                    { label: t("ai.riskAnalysisLabel"), color: "text-orange-600", value: getAiRec.data.riskAnalysis },
                  ].map(item => (
                    <div key={item.label} className="p-2.5 bg-background rounded-lg shadow-sm border border-border">
                      <p className={cn("font-semibold mb-0.5 text-xs", item.color)}>{item.label}</p>
                      <p className="text-muted-foreground leading-relaxed">{item.value}</p>
                    </div>
                  ))}
                </div>
                {/* Lit Vault */}
                <div className="border border-orange-300 bg-orange-50/40 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-orange-600" />
                    <p className="text-xs font-bold text-orange-800">{t("ai.storePrivateVault")}</p>
                  </div>
                  {litVaultSoilRecord ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 space-y-1">
                      <div className="flex items-center gap-1 text-green-700 text-[11px] font-semibold">
                        <ShieldCheck className="w-3 h-3" />{t("ai.soilDataEncrypted")}
                      </div>
                      <code className="text-[10px] font-mono text-green-800 block truncate">{litVaultSoilRecord.filecoinCid}</code>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full border-orange-400 text-orange-700 hover:bg-orange-100 h-7 text-[11px]" onClick={handleEncryptSoilToVault} disabled={litEncryptMutation.isPending}>
                      {litEncryptMutation.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Encrypting…</> : <><Lock className="w-3 h-3 mr-1" />Encrypt to Lit Vault + Filecoin</>}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rec history */}
          {recHistory && recHistory.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-sm px-1 flex items-center gap-1.5"><History className="w-3.5 h-3.5" />{t("ai.pastRecommendations")}</p>
              {recHistory.slice(0, 3).map((rec: any) => (
                <Card key={rec.id} className="cursor-pointer hover:border-primary transition-colors">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Health: {rec.cropHealthPercent}%</p>
                      <p className="text-xs text-muted-foreground">{new Date(rec.createdAt).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 2 — DISEASE SCANNER
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="disease" className="space-y-4 mt-3">
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
            <Shield className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Photos & diagnosis auto-archived to <strong>Filecoin/IPFS</strong> as tamper-proof insurance evidence</span>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />Crop Disease Scanner
              </CardTitle>
              <CardDescription className="text-xs">Upload a photo — AI diagnoses & archives as evidence</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDiseaseSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Crop Photo (Evidence)</Label>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                  {!imagePreview ? (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 transition-all text-muted-foreground">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <FileImage className="w-5 h-5" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-sm">Upload crop photo</p>
                        <p className="text-xs">Tap to open camera or gallery</p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                        <Database className="w-3 h-3" />Will archive to IPFS as evidence
                      </div>
                    </button>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <img src={imagePreview} alt="Crop" className="w-full h-44 object-cover" />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-black/60 text-white rounded-full p-1.5"><Upload className="w-3 h-3" /></button>
                        <button type="button" onClick={clearImage} className="bg-black/60 text-white rounded-full p-1.5"><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="crop" className="text-xs">Crop Name (Optional)</Label>
                  <Input id="crop" placeholder="e.g. Wheat, Tomato, Rice" value={diseaseForm.cropName} onChange={e => setDiseaseForm({ ...diseaseForm, cropName: e.target.value })} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="symptoms" className="text-xs">Symptoms <span className="text-muted-foreground">(optional if photo provided)</span></Label>
                  <Textarea id="symptoms" placeholder="e.g. Yellowing leaves with brown spots..." rows={2} value={diseaseForm.imageDescription} onChange={e => setDiseaseForm({ ...diseaseForm, imageDescription: e.target.value })} className="text-sm" />
                </div>
                <Button type="submit" className="w-full relative" size="sm" disabled={isRunning}>
                  {isRunning ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{archiving ? "Archiving to IPFS..." : t("ai.analyzing")}</> : <><Camera className="w-3.5 h-3.5 mr-1.5" />{t("ai.analyzeDisease")} {walletAddress && <span className="absolute right-3 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">+10 FLOW</span>}</>}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Disease result */}
          {diagnosisData && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm text-destructive flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />{t("ai.diseaseDetected")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-background p-2 rounded-lg text-center shadow-sm">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">Disease</p>
                    <p className="font-bold text-sm text-destructive truncate">{diagnosisData.diseaseName}</p>
                  </div>
                  <div className="bg-background p-2 rounded-lg text-center shadow-sm">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">Confidence</p>
                    <p className="font-bold text-sm">{diagnosisData.confidencePercent}%</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { label: "Plant", value: diagnosisData.plantName },
                    { label: "Severity", value: diagnosisData.severity },
                    { label: "Treatment", value: diagnosisData.treatment },
                  ].map(item => (
                    <div key={item.label} className="p-2.5 bg-background rounded-lg border border-border">
                      <p className="font-semibold mb-0.5">{item.label}</p>
                      <p className="text-muted-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* IPFS Evidence */}
                {evidence && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold">
                      <Database className="w-3 h-3" />Evidence Archived to Filecoin/IPFS
                    </div>
                    {[
                      { label: "Report CID", cid: evidence.reportCid, url: evidence.reportUrl },
                      ...(evidence.imageCid !== evidence.reportCid ? [{ label: "Photo CID", cid: evidence.imageCid, url: evidence.imageUrl }] : []),
                    ].map(({ label, cid, url }) => (
                      <div key={label} className="space-y-0.5">
                        <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
                        <div className="flex items-center gap-1.5">
                          <code className="text-[10px] font-mono text-green-800 flex-1 truncate">{cid}</code>
                          <button onClick={() => copyToClipboard(cid, label)} className="text-green-600">
                            {copiedCid === label ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500"><ExternalLink className="w-3 h-3" /></a>
                        </div>
                      </div>
                    ))}
                    <div className="text-[10px] px-1.5 py-0.5 rounded w-fit font-medium bg-green-200 text-green-800">
                      ✅ Filecoin CID
                    </div>
                  </div>
                )}

                {/* Lit Vault */}
                <div className="border border-orange-300 bg-orange-50/40 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-orange-600" />
                    <p className="text-xs font-bold text-orange-800">Encrypt to Private Vault</p>
                  </div>
                  {litVaultRecord ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 space-y-1">
                      <div className="flex items-center gap-1 text-green-700 text-[11px] font-semibold">
                        <ShieldCheck className="w-3 h-3" />Encrypted on Filecoin
                      </div>
                      <code className="text-[10px] font-mono text-green-800 block truncate">{litVaultRecord.filecoinCid}</code>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full border-orange-400 text-orange-700 hover:bg-orange-100 h-7 text-[11px]" onClick={() => handleEncryptDiseaseToVault()} disabled={litEncryptMutation.isPending}>
                      {litEncryptMutation.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Encrypting…</> : <><Lock className="w-3 h-3 mr-1" />Encrypt to Lit Vault + Filecoin</>}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disease history */}
          {diseaseHistory && diseaseHistory.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-sm px-1 flex items-center gap-1.5"><History className="w-3.5 h-3.5" />{t("ai.scanHistory")}</p>
              {diseaseHistory.slice(0, 3).map((scan: any, idx: number) => (
                <Card key={scan.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{scan.diseaseName}</p>
                        <p className="text-xs text-muted-foreground">{scan.plantName} · {scan.confidencePercent}% confidence</p>
                        <p className="text-xs text-muted-foreground">{new Date(scan.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", scan.severity === "LOW" ? "bg-green-100 text-green-700" : scan.severity === "HIGH" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>
                        {scan.severity}
                      </div>
                    </div>
                    {scan.filecoinCid && (
                      <button onClick={() => handleEncryptDiseaseToVault(scan.id)} className="mt-2 flex items-center gap-1 text-[10px] text-orange-600 font-medium hover:text-orange-800">
                        <Lock className="w-3 h-3" />Encrypt this scan to vault
                      </button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════
            TAB 3 — CHARTS & ANALYTICS
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="charts" className="space-y-4 mt-3">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Activity, label: "Total Readings", value: loadingSummary ? "-" : String(summary?.totalSensorReadings ?? 0) },
              { icon: TrendingUp, label: "Avg Health", value: loadingSummary ? "-" : `${summary?.avgCropHealth != null ? Math.round(summary.avgCropHealth) : 0}%` },
              { icon: FlaskConical, label: "Avg pH", value: loadingSummary ? "-" : summary?.avgSoilPh != null ? Number(summary.avgSoilPh).toFixed(1) : "-" },
              { icon: Droplets, label: "Avg Moisture", value: loadingSummary ? "-" : `${summary?.avgMoisture != null ? Math.round(summary.avgMoisture) : 0}%` },
            ].map(({ icon: Icon, label, value }) => (
              <Card key={label}>
                <CardContent className="p-3 flex flex-col items-center text-center">
                  <Icon className="w-4 h-4 text-primary mb-1" />
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* NPK Chart */}
          <Card>
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />NPK Trends
              </CardTitle>
              <CardDescription className="text-xs">Nitrogen · Phosphorus · Potassium (mg/kg)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[180px] w-full">
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
                ) : <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data yet — trigger LIVE sensor on Home page</div>}
              </div>
            </CardContent>
          </Card>

          {/* pH + Moisture Chart */}
          <Card>
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />pH & Moisture Trends
              </CardTitle>
              <CardDescription className="text-xs">Soil pH · Moisture %</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[180px] w-full">
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
                ) : <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data yet</div>}
              </div>
            </CardContent>
          </Card>

          {/* System activity */}
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm">{t("analytics.systemActivity")}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : logs && logs.length > 0 ? (
                <div className="space-y-2">
                  {logs.map((log: any) => (
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

        {/* ══════════════════════════════════════════════════════════
            TAB 4 — OPEN AGRICULTURAL DATA COMMONS
        ══════════════════════════════════════════════════════════ */}
        <TabsContent value="market" className="space-y-4 mt-3">

          {/* Header card — publish action */}
          <Card className="bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-100">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                  <Globe className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Open Agricultural Data Commons</p>
                  <p className="text-xs text-muted-foreground">Publish your soil sensor data to <span className="font-semibold text-violet-700">IPFS/Filecoin</span> — verifiable, permanent, citable</p>
                </div>
              </div>

              {/* dataset preview */}
              {hasData && (
                <div className="bg-white/70 rounded-lg p-2.5 mb-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Dataset Preview — {recordCount} readings</p>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { label: "N", value: sensorAvg("nitrogen").toFixed(0) + " mg/kg", color: "text-green-700 bg-green-100" },
                      { label: "P", value: sensorAvg("phosphorus").toFixed(0) + " mg/kg", color: "text-orange-700 bg-orange-100" },
                      { label: "K", value: sensorAvg("potassium").toFixed(0) + " mg/kg", color: "text-purple-700 bg-purple-100" },
                      { label: "pH", value: sensorAvg("ph").toFixed(1), color: "text-blue-700 bg-blue-100" },
                      { label: "H₂O", value: sensorAvg("moisture").toFixed(0) + "%", color: "text-cyan-700 bg-cyan-100" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={cn("rounded p-1.5 text-center", color)}>
                        <p className="text-[9px] font-bold">{label}</p>
                        <p className="text-[9px] font-semibold leading-tight">{value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">License: CC BY 4.0 · Device: ESP32-FARM-001 · Schema: smartfasal/soil-sensor/v1</p>
                </div>
              )}

              <Button
                onClick={handlePublishData}
                disabled={publishing || !hasData}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                size="sm"
              >
                {publishing
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Uploading to IPFS…</>
                  : <><Globe className="w-3.5 h-3.5 mr-1.5" />Publish to Data Commons {walletAddress && <span className="ml-1 text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">+15 pts</span>}</>
                }
              </Button>
              {!hasData && <p className="text-[10px] text-center text-muted-foreground mt-1.5">Generate sensor readings first from the Home page</p>}
            </CardContent>
          </Card>

          {/* My published datasets */}
          {myPublished.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> My Published Datasets
              </p>
              {myPublished.map(entry => (
                <Card key={entry.id} className="border-emerald-200 bg-emerald-50/30">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-tight truncate">{entry.datasetTitle}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{entry.recordCount} readings · {entry.location}</p>
                      </div>
                      {entry.isReal === "true" ? (
                        <span className="shrink-0 text-[9px] bg-emerald-600 text-white rounded-full px-2 py-0.5 font-semibold">LIVE ON IPFS</span>
                      ) : (
                        <span className="shrink-0 text-[9px] bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 font-semibold">IPFS HASH</span>
                      )}
                    </div>
                    <div className="bg-white/80 rounded p-2 space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground">Content ID (CID)</p>
                      <div className="flex items-center gap-1.5">
                        <code className="text-[10px] font-mono text-violet-800 flex-1 truncate">{entry.cid}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(entry.cid); toast({ title: "CID copied!" }); }}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <a
                        href={entry.ipfsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-2.5 h-2.5" /> View on IPFS Gateway
                      </a>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-700">
                      <CheckCircle2 className="w-3 h-3" />
                      Permanently stored · CC BY 4.0 · Anyone can cite this CID
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Platform-wide data registry */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-violet-600" /> Community Data Registry
              </p>
              <button onClick={fetchCatalog} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Refresh
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">Soil datasets contributed by farmers on this platform — each CID is verifiable on IPFS</p>

            {catalogLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : catalog.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center">
                  <Database className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No datasets yet</p>
                  <p className="text-[11px] text-muted-foreground">Be the first to publish your soil data to the commons</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {/* summary stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-violet-50 border border-violet-100 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-violet-700">{catalog.length}</p>
                    <p className="text-[10px] text-muted-foreground">Datasets</p>
                  </div>
                  <div className="bg-violet-50 border border-violet-100 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-violet-700">{catalog.reduce((s, e) => s + e.recordCount, 0).toLocaleString("en-IN")}</p>
                    <p className="text-[10px] text-muted-foreground">Readings</p>
                  </div>
                  <div className="bg-violet-50 border border-violet-100 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-violet-700">{catalog.reduce((s, e) => s + e.accessCount, 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Accesses</p>
                  </div>
                </div>

                {catalog.map(entry => (
                  <Card key={entry.id} className="border-violet-100/60">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold leading-tight">{entry.datasetTitle}</p>
                          <p className="text-[10px] text-muted-foreground">{entry.recordCount} readings · {entry.location} · {new Date(entry.createdAt).toLocaleDateString("en-IN")}</p>
                        </div>
                        {entry.isReal === "true" ? (
                          <span className="shrink-0 text-[9px] bg-emerald-600 text-white rounded-full px-2 py-0.5 font-semibold">LIVE</span>
                        ) : (
                          <span className="shrink-0 text-[9px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">IPFS</span>
                        )}
                      </div>

                      {/* NPK mini bars */}
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { label: "N", value: entry.avgNitrogen.toFixed(0), color: "bg-green-500", max: 300 },
                          { label: "P", value: entry.avgPhosphorus.toFixed(0), color: "bg-orange-500", max: 150 },
                          { label: "K", value: entry.avgPotassium.toFixed(0), color: "bg-purple-500", max: 400 },
                        ].map(({ label, value, color, max }) => (
                          <div key={label}>
                            <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                              <span>{label}</span><span>{value}</span>
                            </div>
                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, (parseFloat(value) / max) * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <code className="text-[9px] font-mono text-muted-foreground">{entry.cid.slice(0, 12)}…{entry.cid.slice(-6)}</code>
                        <a
                          href={entry.ipfsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={async () => {
                            try { await fetch(apiUrl(`/api/data-catalog/${entry.id}/access`), { method: "POST" }); } catch {}
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> Open
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* What this means callout */}
          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="p-3">
              <div className="flex gap-2">
                <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-900">Why this matters</p>
                  <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                    Each published dataset gets a permanent IPFS CID — a cryptographic fingerprint that makes the data verifiable forever. Research institutions like ICAR and CGIAR use CID-referenced open datasets for soil science. Your data, cited by researchers, traceable back to you.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}
