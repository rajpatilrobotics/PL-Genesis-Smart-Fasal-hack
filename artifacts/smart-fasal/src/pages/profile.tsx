import { useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wallet, Award, Database, ShieldCheck, Zap, Lock,
  Users, Globe, Clock, CheckCircle2, AlertTriangle,
  Leaf, Star, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskStatus } from "@/lib/wallet-context";

function RiskBadge({ risk }: { risk: RiskStatus }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border",
      risk === "Low" ? "bg-green-50 text-green-700 border-green-200" :
      risk === "Medium" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
      "bg-red-50 text-red-700 border-red-200"
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", risk === "Low" ? "bg-green-500" : risk === "Medium" ? "bg-yellow-500" : "bg-red-500")} />
      {risk}
    </span>
  );
}

function AccessBadge({ level }: { level: string }) {
  if (level === "Private") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
      <Lock className="w-2.5 h-2.5" /> Private
    </span>
  );
  if (level === "Expert") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
      <Users className="w-2.5 h-2.5" /> Expert
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
      <Globe className="w-2.5 h-2.5" /> Public
    </span>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function Profile() {
  const { walletAddress, flowRewards, contributionCount, dataHistory, certificates, currentRisk, handleConnect } = useWallet();
  const [activeTab, setActiveTab] = useState<"timeline" | "expert">("timeline");

  if (!walletAddress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Wallet className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-1">Connect Your Wallet</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Connect your Flow wallet to view your farmer profile, rewards, and data history.
          </p>
        </div>
        <Button onClick={handleConnect} className="rounded-full px-8">
          <Wallet className="w-4 h-4 mr-2" />
          Connect Flow Wallet
        </Button>
      </div>
    );
  }

  const expertEntries = dataHistory.filter(e => e.accessLevel === "Expert" || e.accessLevel === "Public");
  const totalRewardEarned = dataHistory.reduce((sum, e) => sum + e.reward, 0);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Profile Hero Card */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-5">
          <Leaf className="w-40 h-40 -mr-8 -mt-8" />
        </div>
        <CardContent className="p-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Leaf className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold">Farmer Profile</h2>
                {contributionCount >= 3 && (
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">
                    <Star className="w-2.5 h-2.5 mr-1" />
                    Sustainable Farmer
                  </Badge>
                )}
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-0.5 truncate">
                {walletAddress}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full border border-green-200">
                  Flow Testnet
                </span>
                <span className="text-[10px] text-muted-foreground">Network: <span className="font-semibold text-foreground">Flow Blockchain</span></span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Total Rewards</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">{flowRewards + totalRewardEarned}</p>
            <p className="text-[10px] text-amber-600 mt-0.5">FLOW tokens earned</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">Contributions</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{contributionCount}</p>
            <p className="text-[10px] text-blue-600 mt-0.5">Data uploads</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border",
          currentRisk === "Low" ? "bg-green-50 border-green-200" :
          currentRisk === "High" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className={cn("w-4 h-4",
                currentRisk === "Low" ? "text-green-600" :
                currentRisk === "High" ? "text-red-600" : "text-yellow-600"
              )} />
              <span className={cn("text-xs font-semibold",
                currentRisk === "Low" ? "text-green-700" :
                currentRisk === "High" ? "text-red-700" : "text-yellow-700"
              )}>Risk Level</span>
            </div>
            <RiskBadge risk={currentRisk} />
            <p className="text-[10px] text-muted-foreground mt-1">
              {currentRisk === "High" ? "Insurance triggered" : "Current status"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold text-purple-700">Certificates</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{certificates.length}</p>
            <p className="text-[10px] text-purple-600 mt-0.5">Hypercerts earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Hypercerts */}
      {certificates.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Hypercerts Earned
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 flex flex-wrap gap-2">
            {certificates.map((cert) => (
              <div key={cert} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-amber-700">
                <Star className="w-3 h-3 text-amber-500" />
                {cert}
              </div>
            ))}
            {contributionCount < 3 && (
              <div className="flex items-center gap-1.5 bg-muted/50 border border-dashed border-muted-foreground/30 rounded-xl px-3 py-1.5 text-xs text-muted-foreground">
                <Star className="w-3 h-3" />
                Sustainable Farmer ({3 - contributionCount} more uploads)
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl bg-muted/50 p-1 gap-1">
        <button
          onClick={() => setActiveTab("timeline")}
          className={cn(
            "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
            activeTab === "timeline" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
          )}
        >
          <Clock className="w-4 h-4 inline mr-1.5" />
          Timeline
        </button>
        <button
          onClick={() => setActiveTab("expert")}
          className={cn(
            "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
            activeTab === "expert" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
          )}
        >
          <Users className="w-4 h-4 inline mr-1.5" />
          Expert View
        </button>
      </div>

      {/* Timeline Tab */}
      {activeTab === "timeline" && (
        <div>
          {dataHistory.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No data yet</p>
                <p className="text-xs text-muted-foreground mt-1">Run the "Analyze Farm" pipeline to start your timeline.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-4">
                {dataHistory.map((entry, i) => (
                  <div key={entry.cid} className="relative pl-12">
                    <div className="absolute left-3.5 top-3 w-3 h-3 rounded-full border-2 border-primary bg-background" />
                    <Card className={cn(
                      "border",
                      entry.riskStatus === "High" ? "border-red-100" :
                      entry.riskStatus === "Low" ? "border-green-100" : "border-yellow-100"
                    )}>
                      <CardContent className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground">{formatTime(entry.timestamp)}</p>
                            <p className="font-mono text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                              {entry.cid.substring(0, 24)}...
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <RiskBadge risk={entry.riskStatus} />
                            <AccessBadge level={entry.accessLevel} />
                          </div>
                        </div>

                        {(entry.aiHealth !== undefined || entry.aiYield !== undefined) && (
                          <div className="flex gap-3 text-xs">
                            <span className="text-muted-foreground">Health: <span className="font-bold text-primary">{entry.aiHealth}%</span></span>
                            <span className="text-muted-foreground">Yield: <span className="font-bold text-primary">{entry.aiYield}%</span></span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-amber-600 font-semibold">+{entry.reward} FLOW</span>
                          {entry.riskStatus === "High" && (
                            <span className="flex items-center gap-1 text-[10px] text-red-600 font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              Insurance Triggered
                            </span>
                          )}
                          {entry.riskStatus !== "High" && (
                            <span className="flex items-center gap-1 text-[10px] text-green-600">
                              <CheckCircle2 className="w-3 h-3" />
                              Secure
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expert View Tab */}
      {activeTab === "expert" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-xs text-blue-700 font-medium">
              Showing {expertEntries.length} entries accessible to verified experts via Lit Protocol.
              <span className="font-semibold"> Private entries are hidden.</span>
            </p>
          </div>

          {expertEntries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No expert-accessible entries</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Run an analysis with "Expert" or "Public" access level.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {expertEntries.map((entry) => (
                <Card key={entry.cid} className="border-blue-100">
                  <CardContent className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">Farm Analysis Entry</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatTime(entry.timestamp)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <AccessBadge level={entry.accessLevel} />
                        <RiskBadge risk={entry.riskStatus} />
                      </div>
                    </div>

                    <div className="bg-muted/40 rounded-xl p-2.5 space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Sensor Data</p>
                      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                        <span>N: <span className="font-semibold">{entry.nitrogen ?? "—"}</span></span>
                        <span>P: <span className="font-semibold">{entry.phosphorus ?? "—"}</span></span>
                        <span>K: <span className="font-semibold">{entry.potassium ?? "—"}</span></span>
                        <span>pH: <span className="font-semibold">{entry.ph ?? "—"}</span></span>
                        <span>H₂O: <span className="font-semibold">{entry.moisture ? `${entry.moisture}%` : "—"}</span></span>
                        <span>°C: <span className="font-semibold">{entry.temperature ?? "—"}</span></span>
                      </div>
                    </div>

                    {entry.insights && (
                      <p className="text-[10px] text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-2">
                        {entry.insights}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[55%]">
                        {entry.cid.substring(0, 20)}...
                      </span>
                      <span className="text-amber-600 font-semibold">+{entry.reward} FLOW</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
