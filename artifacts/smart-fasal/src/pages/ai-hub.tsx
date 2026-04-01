import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useGetAiRecommendation,
  useDetectDisease,
  useGetAiRecommendationHistory,
  getGetAiRecommendationHistoryQueryKey
} from "@workspace/api-client-react";
import { Brain, Search, Sparkles, AlertTriangle, ChevronRight, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/lib/wallet-context";

export default function AiHub() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { walletAddress, addFlowReward } = useWallet();

  const [recForm, setRecForm] = useState({
    nitrogen: "120", phosphorus: "45", potassium: "180", ph: "6.5", moisture: "40"
  });
  const [diseaseForm, setDiseaseForm] = useState({ cropName: "", imageDescription: "" });

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
      onError: () => {
        toast({ title: "Error", description: "Failed to get recommendation.", variant: "destructive" });
      }
    });
  };

  const handleDiseaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!diseaseForm.imageDescription) return;
    detectDisease.mutate({
      data: { cropName: diseaseForm.cropName, imageDescription: diseaseForm.imageDescription }
    }, {
      onSuccess: () => {
        toast({ title: "Detection Complete", description: "Review the diagnosis below." });
        if (walletAddress) addFlowReward("Disease Detection Analysis", 10);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to analyze symptoms.", variant: "destructive" });
      }
    });
  };

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
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="disease" data-testid="tab-disease">Disease Detect</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Manual Analysis</CardTitle>
              <CardDescription>Enter soil parameters for custom advice</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRecSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="n">N (mg/kg)</Label>
                    <Input id="n" value={recForm.nitrogen} onChange={e => setRecForm({ ...recForm, nitrogen: e.target.value })} type="number" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="p">P (mg/kg)</Label>
                    <Input id="p" value={recForm.phosphorus} onChange={e => setRecForm({ ...recForm, phosphorus: e.target.value })} type="number" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="k">K (mg/kg)</Label>
                    <Input id="k" value={recForm.potassium} onChange={e => setRecForm({ ...recForm, potassium: e.target.value })} type="number" required />
                  </div>
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
                <Button type="submit" className="w-full relative" disabled={getAiRec.isPending} data-testid="button-submit-rec">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {getAiRec.isPending ? "Analyzing..." : "Generate Insights"}
                  {walletAddress && (
                    <span className="absolute right-3 text-[9px] bg-white/20 px-1.5 py-px rounded-full">+10 FLOW</span>
                  )}
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
                  <div className="bg-background p-2 rounded-lg text-center shadow-sm">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">Health</p>
                    <p className="font-bold text-lg">{getAiRec.data.cropHealthPercent}%</p>
                  </div>
                  <div className="bg-background p-2 rounded-lg text-center shadow-sm">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">Risk</p>
                    <p className={`font-bold text-sm mt-1 ${getAiRec.data.riskLevel === 'LOW' ? 'text-green-600' : getAiRec.data.riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'}`}>
                      {getAiRec.data.riskLevel}
                    </p>
                  </div>
                  <div className="bg-background p-2 rounded-lg text-center shadow-sm">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">Yield</p>
                    <p className="font-bold text-lg">{getAiRec.data.yieldPercent}%</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-background rounded-lg shadow-sm border border-border">
                    <p className="font-semibold mb-1 text-primary">Fertilizer Advice</p>
                    <p className="text-muted-foreground">{getAiRec.data.fertilizerAdvice}</p>
                  </div>
                  <div className="p-3 bg-background rounded-lg shadow-sm border border-border">
                    <p className="font-semibold mb-1 text-blue-600">Irrigation</p>
                    <p className="text-muted-foreground">{getAiRec.data.irrigationSuggestion}</p>
                  </div>
                  <div className="p-3 bg-background rounded-lg shadow-sm border border-border">
                    <p className="font-semibold mb-1 text-orange-600">Risk Analysis</p>
                    <p className="text-muted-foreground">{getAiRec.data.riskAnalysis}</p>
                  </div>
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

        <TabsContent value="disease" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Crop Disease Scanner</CardTitle>
              <CardDescription>Describe symptoms to detect plant diseases</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDiseaseSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="crop">Crop Name (Optional)</Label>
                  <Input id="crop" placeholder="e.g. Wheat, Tomato" value={diseaseForm.cropName}
                    onChange={e => setDiseaseForm({ ...diseaseForm, cropName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="symptoms">Describe Symptoms</Label>
                  <Textarea id="symptoms" placeholder="e.g. Yellowing leaves with brown spots..." rows={4} required
                    value={diseaseForm.imageDescription}
                    onChange={e => setDiseaseForm({ ...diseaseForm, imageDescription: e.target.value })} />
                </div>
                <Button type="submit" className="w-full relative" disabled={detectDisease.isPending} data-testid="button-submit-disease">
                  <Search className="w-4 h-4 mr-2" />
                  {detectDisease.isPending ? "Scanning..." : "Scan & Detect"}
                  {walletAddress && (
                    <span className="absolute right-3 text-[9px] bg-white/20 px-1.5 py-px rounded-full">+10 FLOW</span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {detectDisease.data && (
            <Card className={`border-2 ${detectDisease.data.severity === 'HIGH' ? 'border-destructive bg-destructive/5' : 'border-accent bg-accent/5'}`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className={`w-5 h-5 ${detectDisease.data.severity === 'HIGH' ? 'text-destructive' : 'text-accent'}`} />
                    Diagnosis Result
                  </CardTitle>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${detectDisease.data.severity === 'HIGH' ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground'}`}>
                    {detectDisease.data.severity} SEVERITY
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 bg-background p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold">Plant</p>
                    <p className="font-semibold">{detectDisease.data.plantName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold">Confidence</p>
                    <p className="font-semibold">{detectDisease.data.confidencePercent}%</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Detected Disease</p>
                    <p className="font-bold text-lg text-destructive">{detectDisease.data.diseaseName}</p>
                  </div>
                </div>
                <div className="bg-background p-3 rounded-lg border border-border shadow-sm">
                  <p className="font-bold mb-1">Recommended Treatment</p>
                  <p className="text-sm text-muted-foreground">{detectDisease.data.treatment}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
