import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useGetAiRecommendation,
  useDetectDisease,
  useGetAiRecommendationHistory,
  getGetAiRecommendationHistoryQueryKey
} from "@workspace/api-client-react";
import {
  Brain, Search, Sparkles, AlertTriangle, ChevronRight, Zap,
  Camera, Upload, X, Shield, Copy, ExternalLink, CheckCircle2,
  Loader2, FileImage, Database, ClipboardList
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet-context";
import { lighthouseUpload, lighthouseUploadFile } from "@/lib/lighthouse";
import { cn } from "@/lib/utils";

type EvidenceRecord = {
  imageCid: string;
  imageUrl: string;
  reportCid: string;
  reportUrl: string;
  real: boolean;
  archivedAt: string;
};

export default function AiHub() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { walletAddress, addFlowReward } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recForm, setRecForm] = useState({
    nitrogen: "120", phosphorus: "45", potassium: "180", ph: "6.5", moisture: "40"
  });
  const [diseaseForm, setDiseaseForm] = useState({ cropName: "", imageDescription: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  const [copiedCid, setCopiedCid] = useState<string | null>(null);

  const getAiRec = useGetAiRecommendation();
  const detectDisease = useDetectDisease();

  const { data: recHistory } = useGetAiRecommendationHistory({
    query: { queryKey: getGetAiRecommendationHistoryQueryKey() }
  });

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
        toast({ title: "Analysis Complete", description: "New recommendation generated." });
        queryClient.invalidateQueries({ queryKey: getGetAiRecommendationHistoryQueryKey() });
        if (walletAddress) addFlowReward("AI Crop Recommendation", 10);
      },
      onError: () => toast({ title: "Error", description: "Failed to get recommendation.", variant: "destructive" })
    });
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
      data: {
        cropName: diseaseForm.cropName || null,
        imageDescription: diseaseForm.imageDescription || null,
        imageBase64,
        imageMimeType,
      }
    }, {
      onSuccess: (data) => {
        toast({ title: "Detection Complete", description: "Archiving evidence to Filecoin..." });
        if (walletAddress) addFlowReward("Disease Detection Analysis", 10);
        archiveEvidence(data);
      },
      onError: () => toast({ title: "Error", description: "Failed to analyze.", variant: "destructive" })
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCid(label);
    setTimeout(() => setCopiedCid(null), 2000);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const diagnosisData = detectDisease.data;
  const isRunning = detectDisease.isPending || archiving;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Farm Hub</h2>
        <p className="text-muted-foreground text-sm">Powered insights for better yields</p>
        {walletAddress && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 w-fit">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Each AI analysis earns <strong>+10 FLOW</strong>
          </div>
        )}
      </div>

      <Tabs defaultValue="recommendations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="disease">Disease Scanner</TabsTrigger>
        </TabsList>

        {/* ── Recommendations Tab ── */}
        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Manual Analysis</CardTitle>
              <CardDescription>Enter soil parameters for custom advice</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRecSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "n", label: "N (mg/kg)", key: "nitrogen" },
                    { id: "p", label: "P (mg/kg)", key: "phosphorus" },
                    { id: "k", label: "K (mg/kg)", key: "potassium" },
                  ].map(f => (
                    <div key={f.id} className="space-y-1">
                      <Label htmlFor={f.id}>{f.label}</Label>
                      <Input id={f.id} value={recForm[f.key as keyof typeof recForm]}
                        onChange={e => setRecForm({ ...recForm, [f.key]: e.target.value })} type="number" required />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="ph">pH Level</Label>
                    <Input id="ph" value={recForm.ph} onChange={e => setRecForm({ ...recForm, ph: e.target.value })} type="number" step="0.1" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="moisture">Moisture %</Label>
                    <Input id="moisture" value={recForm.moisture} onChange={e => setRecForm({ ...recForm, moisture: e.target.value })} type="number" required />
                  </div>
                </div>
                <Button type="submit" className="w-full relative" disabled={getAiRec.isPending}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {getAiRec.isPending ? "Analyzing..." : "Generate Insights"}
                  {walletAddress && <span className="absolute right-3 text-[9px] bg-white/20 px-1.5 py-px rounded-full">+10 FLOW</span>}
                </Button>
              </form>
            </CardContent>
          </Card>

          {getAiRec.data && (
            <Card className="border-primary bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-primary flex items-center">
                  <Brain className="w-5 h-5 mr-2" /> AI Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Health", value: `${getAiRec.data.cropHealthPercent}%` },
                    { label: "Risk", value: getAiRec.data.riskLevel, color: getAiRec.data.riskLevel === "LOW" ? "text-green-600" : getAiRec.data.riskLevel === "MEDIUM" ? "text-yellow-600" : "text-red-600" },
                    { label: "Yield", value: `${getAiRec.data.yieldPercent}%` },
                  ].map(item => (
                    <div key={item.label} className="bg-background p-2 rounded-lg text-center shadow-sm">
                      <p className="text-[10px] uppercase text-muted-foreground font-bold">{item.label}</p>
                      <p className={cn("font-bold text-lg", item.color)}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Fertilizer Advice", color: "text-primary", value: getAiRec.data.fertilizerAdvice },
                    { label: "Irrigation", color: "text-blue-600", value: getAiRec.data.irrigationSuggestion },
                    { label: "Risk Analysis", color: "text-orange-600", value: getAiRec.data.riskAnalysis },
                  ].map(item => (
                    <div key={item.label} className="p-3 bg-background rounded-lg shadow-sm border border-border">
                      <p className={cn("font-semibold mb-1", item.color)}>{item.label}</p>
                      <p className="text-muted-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {recHistory && recHistory.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-lg px-1">Past Recommendations</h3>
              {recHistory.slice(0, 3).map(rec => (
                <Card key={rec.id} className="cursor-pointer hover:border-primary transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">Health: {rec.cropHealthPercent}%</p>
                      <p className="text-xs text-muted-foreground">{new Date(rec.createdAt).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Disease Scanner Tab ── */}
        <TabsContent value="disease" className="space-y-4">

          {/* Header banner */}
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
            <Shield className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Photos & diagnosis are automatically archived to <strong>Filecoin/IPFS</strong> as tamper-proof insurance evidence</span>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Crop Disease Scanner
              </CardTitle>
              <CardDescription>Upload a photo of your crop — AI diagnoses & Filecoin archives it as evidence</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDiseaseSubmit} className="space-y-4">

                {/* Photo Upload */}
                <div className="space-y-2">
                  <Label>Crop Photo (Evidence)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {!imagePreview ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 transition-all text-muted-foreground"
                    >
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <FileImage className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-sm">Upload crop photo</p>
                        <p className="text-xs mt-0.5">Tap to open camera or gallery</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-blue-600 font-medium">
                        <Database className="w-3 h-3" />
                        Will be archived to IPFS as evidence
                      </div>
                    </button>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <img src={imagePreview} alt="Crop" className="w-full h-48 object-cover" />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={clearImage}
                          className="bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-1.5">
                        <p className="text-white text-xs truncate">{imageFile?.name}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="crop">Crop Name (Optional)</Label>
                  <Input id="crop" placeholder="e.g. Wheat, Tomato, Rice"
                    value={diseaseForm.cropName}
                    onChange={e => setDiseaseForm({ ...diseaseForm, cropName: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="symptoms">Additional Symptoms <span className="text-muted-foreground">(optional if photo provided)</span></Label>
                  <Textarea id="symptoms" placeholder="e.g. Yellowing leaves with brown spots, wilting..."
                    rows={3}
                    value={diseaseForm.imageDescription}
                    onChange={e => setDiseaseForm({ ...diseaseForm, imageDescription: e.target.value })} />
                </div>

                <Button type="submit" className="w-full relative" disabled={isRunning}>
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {detectDisease.isPending ? "AI Diagnosing..." : "Archiving to Filecoin..."}
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Diagnose & Archive Evidence
                      {walletAddress && <span className="absolute right-3 text-[9px] bg-white/20 px-1.5 py-px rounded-full">+10 FLOW</span>}
                    </>
                  )}
                </Button>

                {/* Pipeline status */}
                {isRunning && (
                  <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground py-1">
                    <div className={cn("flex items-center gap-1", detectDisease.isPending ? "text-primary font-medium" : "text-green-600")}>
                      {detectDisease.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      AI Scan
                    </div>
                    <div className="w-4 h-px bg-border" />
                    <div className={cn("flex items-center gap-1", archiving ? "text-primary font-medium" : "text-muted-foreground")}>
                      {archiving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                      Filecoin Archive
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Diagnosis Result */}
          {diagnosisData && (
            <Card className={cn("border-2", diagnosisData.severity === "HIGH"
              ? "border-destructive bg-destructive/5"
              : "border-amber-300 bg-amber-50/50")}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className={cn("w-5 h-5", diagnosisData.severity === "HIGH" ? "text-destructive" : "text-amber-500")} />
                    Diagnosis
                  </CardTitle>
                  <Badge variant={diagnosisData.severity === "HIGH" ? "destructive" : "secondary"}>
                    {diagnosisData.severity} SEVERITY
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 bg-background p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">Plant</p>
                    <p className="font-semibold">{diagnosisData.plantName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">Confidence</p>
                    <p className="font-semibold">{diagnosisData.confidencePercent}%</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-border">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Detected Disease</p>
                    <p className="font-bold text-base text-destructive">{diagnosisData.diseaseName}</p>
                  </div>
                </div>
                <div className="bg-background p-3 rounded-lg border border-border">
                  <p className="font-bold text-sm mb-1">Recommended Treatment</p>
                  <p className="text-sm text-muted-foreground">{diagnosisData.treatment}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evidence Record */}
          {(archiving || evidence) && (
            <Card className={cn("border-2", evidence?.real ? "border-green-400 bg-green-50/50" : "border-blue-300 bg-blue-50/50")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {archiving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-blue-700">Archiving to Filecoin/IPFS...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-green-700">
                        Evidence Archived {evidence?.real ? "on Filecoin ✅" : "(Simulated)"}
                      </span>
                    </>
                  )}
                </CardTitle>
                {!archiving && evidence && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(evidence.archivedAt).toLocaleString()}
                    {!evidence.real && " · Will be real on production deployment"}
                  </p>
                )}
              </CardHeader>

              {evidence && !archiving && (
                <CardContent className="space-y-3">
                  {/* Image CID */}
                  {imageFile && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <FileImage className="w-3 h-3" /> Photo CID
                      </p>
                      <div className="flex items-center gap-2 bg-background rounded-lg border border-border px-3 py-2">
                        <code className="text-xs flex-1 truncate text-muted-foreground font-mono">
                          {evidence.imageCid}
                        </code>
                        <button onClick={() => copyToClipboard(evidence.imageCid, "Photo CID")}
                          className="shrink-0 text-muted-foreground hover:text-foreground">
                          {copiedCid === "Photo CID" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a href={evidence.imageUrl} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Report CID */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Database className="w-3 h-3" /> Evidence Report CID
                    </p>
                    <div className="flex items-center gap-2 bg-background rounded-lg border border-border px-3 py-2">
                      <code className="text-xs flex-1 truncate text-muted-foreground font-mono">
                        {evidence.reportCid}
                      </code>
                      <button onClick={() => copyToClipboard(evidence.reportCid, "Report CID")}
                        className="shrink-0 text-muted-foreground hover:text-foreground">
                        {copiedCid === "Report CID" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <a href={evidence.reportUrl} target="_blank" rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Insurance CTA */}
                  <Button
                    variant="outline"
                    className="w-full border-green-400 text-green-700 hover:bg-green-50"
                    onClick={() => copyToClipboard(
                      `SmartFasal Disease Evidence\nCrop: ${diagnosisData?.plantName}\nDisease: ${diagnosisData?.diseaseName}\nSeverity: ${diagnosisData?.severity}\nConfidence: ${diagnosisData?.confidencePercent}%\nReport CID: ${evidence.reportCid}${imageFile ? `\nPhoto CID: ${evidence.imageCid}` : ""}\nArchived: ${evidence.archivedAt}`,
                      "Insurance Report"
                    )}
                  >
                    <ClipboardList className="w-4 h-4 mr-2" />
                    {copiedCid === "Insurance Report" ? "Copied!" : "Copy as Insurance Evidence"}
                  </Button>

                  <p className="text-[11px] text-center text-muted-foreground">
                    Submit these CIDs with your insurance claim — the data is immutable and verifiable by anyone
                  </p>
                </CardContent>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
