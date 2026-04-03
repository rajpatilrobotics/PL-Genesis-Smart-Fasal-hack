import { useTranslation } from "react-i18next";
import { useGetSensorHistory, getGetSensorHistoryQueryKey, useGetAnalyticsSummary, getGetAnalyticsSummaryQueryKey, useGetAnalyticsLogs, getGetAnalyticsLogsQueryKey, useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Droplets, FlaskConical, TrendingUp, CheckCircle } from "lucide-react";

export default function Analytics() {
  const { t } = useTranslation();
  const { data: history, isLoading: loadingHistory } = useGetSensorHistory({ limit: 20 }, {
    query: {
      queryKey: getGetSensorHistoryQueryKey({ limit: 20 })
    }
  });

  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary({
    query: {
      queryKey: getGetAnalyticsSummaryQueryKey()
    }
  });

  const { data: logs, isLoading: loadingLogs } = useGetAnalyticsLogs({}, {
    query: {
      queryKey: getGetAnalyticsLogsQueryKey({})
    }
  });

  const { data: health } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey()
    }
  });

  const getLogColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'sensor': return 'border-l-blue-500 bg-blue-500/5';
      case 'ai': return 'border-l-green-500 bg-green-500/5';
      case 'insurance': return 'border-l-yellow-500 bg-yellow-500/5';
      case 'error': return 'border-l-red-500 bg-red-500/5';
      default: return 'border-l-gray-500 bg-gray-500/5';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("analytics.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("analytics.subtitle")}</p>
        </div>
        {health && (
          <div className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full border border-green-200">
            <CheckCircle className="w-3 h-3" /> {t("analytics.system")} {health.status}
          </div>
        )}
      </div>

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

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("analytics.npkTrends")}</CardTitle>
          <CardDescription>{t("analytics.last20Readings")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            {loadingHistory ? (
              <Skeleton className="w-full h-full" />
            ) : history && history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...history].reverse()} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="createdAt" 
                    tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Line type="monotone" dataKey="nitrogen" name="Nitrogen" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="phosphorus" name="Phosphorus" stroke="#f97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="potassium" name="Potassium" stroke="#a855f7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                {t("analytics.noData")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("analytics.systemActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className={`p-3 rounded-lg border-l-4 ${getLogColor(log.eventType)}`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">{log.eventType}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm font-medium">{log.description}</p>
                </div>
              ))}
            </div>
          ) : (
             <div className="text-center text-muted-foreground py-4">{t("analytics.noActivity")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
