import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWallet } from "@/lib/wallet-context";
import { useUserProfile, useUpdateProfile } from "@/lib/useUserProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet, Award, Database, ShieldCheck, Zap, Lock,
  Users, Globe, Clock, CheckCircle2, AlertTriangle,
  Leaf, Star, TrendingUp, MapPin, Sprout, Pencil, Save, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskStatus } from "@/lib/wallet-context";

const CROPS = ["Wheat", "Rice", "Maize", "Cotton", "Sugarcane", "Soybean", "Groundnut", "Pulses", "Vegetables", "Fruits", "Other"];
const STATES = ["Andhra Pradesh", "Bihar", "Chhattisgarh", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Other"];

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

export default function Profile() {
  const { t } = useTranslation();
  const { walletAddress, flowRewards, contributionCount, dataHistory, certificates, currentRisk, handleConnect } = useWallet();
  const { data: profileData, isLoading } = useUserProfile();
  const { mutateAsync: updateProfile, isPending: isSaving } = useUpdateProfile();
  const [activeTab, setActiveTab] = useState<"timeline" | "expert">("timeline");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const profile = profileData?.profile;

  const startEdit = () => {
    setEditForm({
      fullName: profile?.fullName ?? "",
      phone: profile?.phone ?? "",
      village: profile?.village ?? "",
      district: profile?.district ?? "",
      state: profile?.state ?? "",
      farmSizeAcres: profile?.farmSizeAcres?.toString() ?? "",
      primaryCrop: profile?.primaryCrop ?? "",
      farmingExperienceYears: profile?.farmingExperienceYears?.toString() ?? "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await updateProfile({
      fullName: editForm.fullName,
      phone: editForm.phone || null as any,
      village: editForm.village || null as any,
      district: editForm.district || null as any,
      state: editForm.state || null as any,
      farmSizeAcres: editForm.farmSizeAcres ? parseFloat(editForm.farmSizeAcres) as any : null as any,
      primaryCrop: editForm.primaryCrop || null as any,
      farmingExperienceYears: editForm.farmingExperienceYears ? parseFloat(editForm.farmingExperienceYears) as any : null as any,
    });
    setEditing(false);
  };

  const expertEntries = dataHistory.filter(e => e.accessLevel === "Expert" || e.accessLevel === "Public");
  const totalRewardEarned = dataHistory.reduce((sum, e) => sum + e.reward, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Hero Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700 p-4 shadow-lg mb-1">
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 blur-xl" />
        <div className="absolute bottom-0 left-4 opacity-10">
          <Leaf className="w-28 h-28" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" />
            </div>
            <p className="text-emerald-100 text-xs font-bold uppercase tracking-wide">Smart Fasal</p>
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">{t("profile.title")}</h2>
          <p className="text-emerald-100/70 text-xs mt-0.5">Credit Score · Farm History · Identity</p>
        </div>
      </div>

      {/* Profile Hero Card */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 overflow-hidden relative">
        <div className="absolute right-0 top-0 opacity-5">
          <Leaf className="w-40 h-40 -mr-8 -mt-8" />
        </div>
        <CardContent className="p-5 relative z-10">
          {editing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm">{t("profile.editProfile")}</span>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">{t("profile.fullName")} *</Label>
                  <Input value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Village</Label>
                  <Input value={editForm.village} onChange={e => setEditForm(f => ({ ...f, village: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">District</Label>
                  <Input value={editForm.district} onChange={e => setEditForm(f => ({ ...f, district: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">State</Label>
                  <select value={editForm.state} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-xs bg-background">
                    <option value="">Select state...</option>
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("profile.farmSize")}</Label>
                  <Input type="number" value={editForm.farmSizeAcres} onChange={e => setEditForm(f => ({ ...f, farmSizeAcres: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Primary Crop</Label>
                  <select value={editForm.primaryCrop} onChange={e => setEditForm(f => ({ ...f, primaryCrop: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-xs bg-background">
                    <option value="">Select crop...</option>
                    {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Experience (years)</Label>
                  <Input type="number" value={editForm.farmingExperienceYears} onChange={e => setEditForm(f => ({ ...f, farmingExperienceYears: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full" onClick={saveEdit} disabled={isSaving || !editForm.fullName.trim()}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? t("profile.saving") : t("profile.saveChanges")}
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                <Leaf className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold">{profile?.fullName ?? "Farmer"}</h2>
                    {contributionCount >= 3 && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-100">
                        <Star className="w-2.5 h-2.5 mr-1" />
                        Sustainable Farmer
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={startEdit}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {profile?.phone && (
                  <p className="text-xs text-muted-foreground mt-0.5">{profile.phone}</p>
                )}

                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {(profile?.village || profile?.district || profile?.state) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {[profile.village, profile.district, profile.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {profile?.primaryCrop && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Sprout className="w-3 h-3" />
                      {profile.primaryCrop}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {profile?.farmSizeAcres && (
                    <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full border border-green-200">
                      {profile.farmSizeAcres} acres
                    </span>
                  )}
                  {profile?.farmingExperienceYears && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full border border-blue-200">
                      {profile.farmingExperienceYears} yrs experience
                    </span>
                  )}
                  {profile?.createdAt && (
                    <span className="text-[10px] text-muted-foreground">
                      Member since {formatDate(profile.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet connect prompt */}
      {!walletAddress && (
        <Card className="border-dashed border-primary/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Connect Flow Wallet</p>
              <p className="text-xs text-muted-foreground">Earn rewards and track contributions</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleConnect} className="shrink-0">Connect</Button>
          </CardContent>
        </Card>
      )}

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
                {dataHistory.map((entry) => (
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
                          {entry.riskStatus === "High" ? (
                            <span className="flex items-center gap-1 text-[10px] text-red-600 font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              Insurance Triggered
                            </span>
                          ) : (
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
                <p className="text-xs text-muted-foreground mt-1">Run an analysis with "Expert" or "Public" access level.</p>
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
