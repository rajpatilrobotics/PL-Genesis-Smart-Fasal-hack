import { useEffect, useState } from "react";
import { 
  useGetWeather, getGetWeatherQueryKey,
  useGetLatestSensorData, getGetLatestSensorDataQueryKey,
  useGetAiRecommendation,
  useStoreOnFilecoin,
  useGetRewards, getGetRewardsQueryKey,
  useSubmitSensorData,
  useGetFilecoinRecords, getGetFilecoinRecordsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CloudRain, Droplets, Thermometer, Wind, Brain, Database, RefreshCw, UploadCloud, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Weather Data
  const { data: weather, isLoading: loadingWeather } = useGetWeather({}, {
    query: {
      queryKey: getGetWeatherQueryKey({}),
    }
  });

  // Sensor Data with polling
  const { data: sensorData, isLoading: loadingSensor } = useGetLatestSensorData({
    query: {
      queryKey: getGetLatestSensorDataQueryKey(),
      refetchInterval: 3000,
    }
  });

  // Filecoin Records
  const { data: filecoinRecords } = useGetFilecoinRecords({
    query: { queryKey: getGetFilecoinRecordsQueryKey() }
  });

  // Update timestamp when sensor data changes
  useEffect(() => {
    if (sensorData) {
      setLastUpdated(new Date());
    }
  }, [sensorData]);

  // Mutations
  const getAiRec = useGetAiRecommendation();
  const storeOnFilecoin = useStoreOnFilecoin();
  const submitSensor = useSubmitSensorData();

  const handleGetRecommendation = () => {
    if (!sensorData) return;
    
    getAiRec.mutate({
      data: {
        nitrogen: sensorData.nitrogen,
        phosphorus: sensorData.phosphorus,
        potassium: sensorData.potassium,
        ph: sensorData.ph,
        moisture: sensorData.moisture,
        temperature: weather?.temperature,
        humidity: weather?.humidity,
        rainfall: weather?.rainfall
      }
    }, {
      onSuccess: () => {
        toast({
          title: "AI Recommendation Updated",
          description: "Latest crop insights are available.",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to generate AI recommendation.",
          variant: "destructive"
        });
      }
    });
  };

  const handleStoreData = () => {
    if (!sensorData) return;
    
    storeOnFilecoin.mutate({
      data: {
        dataType: "sensor_snapshot",
        data: sensorData as any
      }
    }, {
      onSuccess: (res) => {
        toast({
          title: "Secured on Filecoin",
          description: `CID: ${res.cid.substring(0, 10)}...`,
        });
        queryClient.invalidateQueries({ queryKey: getGetFilecoinRecordsQueryKey() });
      }
    });
  };

  const handleSimulateSensor = () => {
    submitSensor.mutate({
      data: {
        nitrogen: Math.floor(Math.random() * 100) + 100,
        phosphorus: Math.floor(Math.random() * 50) + 40,
        potassium: Math.floor(Math.random() * 100) + 150,
        ph: Number((Math.random() * 2 + 5.5).toFixed(1)),
        moisture: Math.floor(Math.random() * 40) + 30
      }
    }, {
      onSuccess: () => {
        toast({ title: "Sensor Synced", description: "Manual sync complete." });
        queryClient.invalidateQueries({ queryKey: getGetLatestSensorDataQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Farm Dashboard</h2>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full cursor-pointer hover:bg-muted/80" onClick={handleSimulateSensor}>
          <RefreshCw className="w-3 h-3 animate-spin-slow" />
          <span>Live: {lastUpdated.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Weather Widget */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
          <CloudRain className="w-32 h-32 -mr-4 -mt-4" />
        </div>
        <CardContent className="p-5">
          {loadingWeather ? (
            <Skeleton className="h-20 w-full" />
          ) : weather ? (
            <div className="flex justify-between items-center relative z-10">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{weather.location}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tighter">{weather.temperature}°C</span>
                  <span className="text-sm font-medium capitalize text-primary">{weather.description}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold">{weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CloudRain className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold">{weather.rainfall}mm</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold">{weather.windSpeed}m/s</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-orange-500" />
                  <span className="font-semibold">{weather.feelsLike}°C</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">Weather data unavailable</div>
          )}
        </CardContent>
      </Card>

      {/* Soil Health NPK */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Soil Nutrients (NPK)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSensor ? (
            <div className="space-y-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
          ) : sensorData ? (
            <>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Nitrogen (N)</span>
                  <span className="font-bold">{sensorData.nitrogen} mg/kg</span>
                </div>
                <Progress value={(sensorData.nitrogen / 200) * 100} className="h-2.5" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Phosphorus (P)</span>
                  <span className="font-bold">{sensorData.phosphorus} mg/kg</span>
                </div>
                <Progress value={(sensorData.phosphorus / 100) * 100} className="h-2.5 [&>div]:bg-orange-500" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Potassium (K)</span>
                  <span className="font-bold">{sensorData.potassium} mg/kg</span>
                </div>
                <Progress value={(sensorData.potassium / 300) * 100} className="h-2.5 [&>div]:bg-purple-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border">
                <div className="bg-muted/50 p-3 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Soil pH</p>
                  <p className="text-xl font-bold">{sensorData.ph}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Moisture</p>
                  <p className="text-xl font-bold">{sensorData.moisture}%</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground">No sensor data</div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          onClick={handleGetRecommendation} 
          disabled={!sensorData || getAiRec.isPending}
          className="h-14 font-semibold text-wrap leading-tight"
          data-testid="button-get-ai-rec"
        >
          <Brain className="w-5 h-5 mr-2 shrink-0" />
          {getAiRec.isPending ? "Analyzing..." : "Get AI Insights"}
        </Button>
        <Button 
          variant="secondary"
          onClick={handleStoreData} 
          disabled={!sensorData || storeOnFilecoin.isPending}
          className="h-14 font-semibold text-wrap leading-tight"
          data-testid="button-store-filecoin"
        >
          <Database className="w-5 h-5 mr-2 shrink-0" />
          {storeOnFilecoin.isPending ? "Securing..." : "Store on Filecoin"}
        </Button>
      </div>

      {/* AI Prediction Result Card (Show if we have a recent mutation result) */}
      {getAiRec.data && (
        <Card className="border-accent/50 bg-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Brain className="w-5 h-5 mr-2 text-accent" /> 
              Latest AI Prediction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 bg-background rounded-lg border border-border">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Health</p>
                <p className="text-lg font-bold text-primary">{getAiRec.data.cropHealthPercent}%</p>
              </div>
              <div className="text-center p-2 bg-background rounded-lg border border-border">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Risk</p>
                <p className={`text-sm font-bold mt-1 ${
                  getAiRec.data.riskLevel === 'LOW' ? 'text-green-600' : 
                  getAiRec.data.riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'
                }`}>{getAiRec.data.riskLevel}</p>
              </div>
              <div className="text-center p-2 bg-background rounded-lg border border-border">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Yield</p>
                <p className="text-lg font-bold text-primary">{getAiRec.data.yieldPercent}%</p>
              </div>
            </div>
            <p className="text-sm">{getAiRec.data.fertilizerAdvice}</p>
          </CardContent>
        </Card>
      )}

      {/* Filecoin Records Link */}
      {filecoinRecords && filecoinRecords.length > 0 && (
        <Card className="bg-transparent border-dashed">
          <CardContent className="p-4 flex justify-between items-center text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="w-4 h-4" />
              {filecoinRecords.length} records secured on IPFS
            </span>
            <Button variant="link" className="h-auto p-0" onClick={() => window.open(filecoinRecords[0].url, '_blank')}>View Latest</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
