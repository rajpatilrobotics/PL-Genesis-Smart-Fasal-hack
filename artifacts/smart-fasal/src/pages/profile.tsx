import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWallet } from "@/lib/wallet-context";
import { useUserProfile, useUpdateProfile } from "@/lib/useUserProfile";
import { useAuthContext } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Wallet, Award, Database, ShieldCheck, Zap, Lock,
  Users, Globe, Clock, CheckCircle2, AlertTriangle,
  Leaf, Star, TrendingUp, MapPin, Sprout, Pencil, Save, X, LogOut, UserCircle
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
  const { user: authUser, logout } = useAuthContext();
  const [, setLocation] = useLocation();
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
    <div className="relative -mx-4 -mt-5 min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ background: "linear-gradient(165deg, #fdf4ff 0%, #fae8ff 28%, #ede9fe 60%, #f5f3ff 100%)" }}>

      {/* Purple blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-purple-300/35 blur-3xl" />
        <div className="absolute top-1/4 -left-16 w-60 h-60 rounded-full bg-violet-200/30 blur-3xl" />
        <div className="absolute top-2/3 right-0 w-56 h-56 rounded-full bg-fuchsia-200/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-purple-100/25 blur-2xl" />
      </div>

      <div className="relative space-y-5 px-4 pt-5 pb-28">

        {/* Hero Header */}
        <div className="relative rounded-2xl overflow-hidden p-4 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/30 active:translate-y-0 mb-1"
          style={{ background: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 45%, #a855f7 100%)", border: "1px solid rgba(255,255,255,0.35)" }}>
          <div className="absolute -top-4 -right-4 w-36 h-36 rounded-full bg-fuchsia-300/20 blur-2xl" />
          <div className="absolute bottom-0 left-4 w-28 h-16 rounded-full bg-violet-300/15 blur-xl" />
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <Sprout className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">{t("profile.title")}</h2>
            </div>
            <p className="text-purple-100/80 text-xs mt-0.5 font-medium">Credit Score · Farm History · Identity</p>
          </div>
        </div>

        {/* Profile Hero Card */}
        <div className="rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl hover:bg-white/45 overflow-hidden relative shadow-sm" style={{ boxShadow: "0 0 0 1px rgba(168,85,247,0.10), 0 4px 24px rgba(168,85,247,0.08)" }}>
          <div className="absolute right-0 top-0 opacity-5">
            <Leaf className="w-40 h-40 -mr-8 -mt-8" />
          </div>
          <div className="p-5 relative z-10">
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
          </div>
        </div>

        {/* Account card */}
        <div className="rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl hover:bg-white/45 p-4 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-purple-100/60 flex items-center justify-center shrink-0">
            <UserCircle className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{authUser?.fullName || "Farmer"}</p>
            <p className="text-xs text-muted-foreground truncate">{authUser?.email}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => { await logout(); setLocation("/sign-in"); }}
            className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" /> Sign Out
          </Button>
        </div>

        {/* Wallet connect prompt */}
        {!walletAddress && (
          <div className="rounded-2xl border border-dashed border-purple-200/60 bg-white/25 backdrop-blur-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100/60 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Connect Flow Wallet</p>
              <p className="text-xs text-muted-foreground">Earn rewards and track contributions</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleConnect} className="shrink-0">Connect</Button>
          </div>
        )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-glow-amber rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-xl bg-amber-100/70 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-xs font-semibold text-amber-700">Total Rewards</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{flowRewards + totalRewardEarned}</p>
          <p className="text-[10px] text-amber-600 mt-0.5">FLOW tokens earned</p>
        </div>

        <div className="glass-glow-blue rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-xl bg-blue-100/70 flex items-center justify-center">
              <Database className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-blue-700">Contributions</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{contributionCount}</p>
          <p className="text-[10px] text-blue-600 mt-0.5">Data uploads</p>
        </div>

        <div className={cn(
          "rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl p-4",
          currentRisk === "Low" ? "glass-glow-emerald" :
          currentRisk === "High" ? "glass-glow" : "glass-glow-amber"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center",
              currentRisk === "Low" ? "bg-green-100/70" :
              currentRisk === "High" ? "bg-red-100/70" : "bg-yellow-100/70"
            )}>
              <ShieldCheck className={cn("w-3.5 h-3.5",
                currentRisk === "Low" ? "text-green-600" :
                currentRisk === "High" ? "text-red-600" : "text-yellow-600"
              )} />
            </div>
            <span className={cn("text-xs font-semibold",
              currentRisk === "Low" ? "text-green-700" :
              currentRisk === "High" ? "text-red-700" : "text-yellow-700"
            )}>Risk Level</span>
          </div>
          <RiskBadge risk={currentRisk} />
          <p className="text-[10px] text-muted-foreground mt-1">
            {currentRisk === "High" ? "Insurance triggered" : "Current status"}
          </p>
        </div>

        <div className="glass-glow-violet rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-xl bg-purple-100/70 flex items-center justify-center">
              <Award className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <span className="text-xs font-semibold text-purple-700">Certificates</span>
          </div>
          <p className="text-2xl font-bold text-purple-700">{certificates.length}</p>
          <p className="text-[10px] text-purple-600 mt-0.5">Hypercerts earned</p>
        </div>
      </div>

      {/* Hypercerts */}
      {certificates.length > 0 && (
        <div className="glass-glow-amber rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl">
          <div className="p-4 pb-2 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold">Hypercerts Earned</span>
          </div>
          <div className="pb-4 px-4 flex flex-wrap gap-2">
            {certificates.map((cert) => (
              <div key={cert} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-amber-700">
                <Star className="w-3 h-3 text-amber-500" />
                {cert}
              </div>
            ))}
            {contributionCount < 3 && (
              <div className="flex items-center gap-1.5 bg-white/50 border border-dashed border-muted-foreground/30 rounded-xl px-3 py-1.5 text-xs text-muted-foreground">
                <Star className="w-3 h-3" />
                Sustainable Farmer ({3 - contributionCount} more uploads)
              </div>
            )}
          </div>
        </div>
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
            <div className="glass-glow rounded-2xl border border-dashed border-white/50 bg-white/30 backdrop-blur-xl">
              <div className="p-8 text-center">
                <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No data yet</p>
                <p className="text-xs text-muted-foreground mt-1">Run the "Analyze Farm" pipeline to start your timeline.</p>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-4">
                {dataHistory.map((entry) => (
                  <div key={entry.cid} className="relative pl-12">
                    <div className="absolute left-3.5 top-3 w-3 h-3 rounded-full border-2 border-primary bg-background" />
                    <div className={cn(
                      "glass-glow rounded-2xl border border-white/50 bg-white/35 backdrop-blur-xl",
                      entry.riskStatus === "High" ? "border-l-4 border-l-red-300" :
                      entry.riskStatus === "Low" ? "border-l-4 border-l-green-300" : "border-l-4 border-l-yellow-300"
                    )}>
                      <div className="p-3.5 space-y-2.5">
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
                      </div>
                    </div>
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
          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50/60 border border-blue-200/60 backdrop-blur-sm">
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="text-xs text-blue-700 font-medium">
              Showing {expertEntries.length} entries accessible to verified experts via Lit Protocol.
              <span className="font-semibold"> Private entries are hidden.</span>
            </p>
          </div>
          {expertEntries.length === 0 ? (
            <div className="glass-glow-blue rounded-2xl border border-dashed border-white/50 bg-white/30 backdrop-blur-xl">
              <div className="p-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No expert-accessible entries</p>
                <p className="text-xs text-muted-foreground mt-1">Run an analysis with "Expert" or "Public" access level.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {expertEntries.map((entry) => (
                <div key={entry.cid} className="glass-glow-blue rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl">
                  <div className="p-3.5 space-y-2.5">
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      </div>
    </div>
  );
}
