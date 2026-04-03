import { useState } from "react";
import { useLocation } from "wouter";
import { useUpdateProfile } from "@/lib/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, ChevronRight, MapPin, Sprout, User } from "lucide-react";

const CROPS = ["Wheat", "Rice", "Maize", "Cotton", "Sugarcane", "Soybean", "Groundnut", "Pulses", "Vegetables", "Fruits", "Other"];
const STATES = ["Andhra Pradesh", "Bihar", "Chhattisgarh", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Other"];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { mutateAsync: updateProfile, isPending } = useUpdateProfile();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    village: "",
    district: "",
    state: "",
    farmSizeAcres: "",
    primaryCrop: "",
    farmingExperienceYears: "",
  });

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleFinish = async () => {
    try {
      await updateProfile({
        fullName: form.fullName,
        phone: form.phone,
        village: form.village,
        district: form.district,
        state: form.state,
        farmSizeAcres: form.farmSizeAcres ? (parseFloat(form.farmSizeAcres) as any) : null,
        primaryCrop: form.primaryCrop,
        farmingExperienceYears: form.farmingExperienceYears ? (parseFloat(form.farmingExperienceYears) as any) : null,
      });
      setLocation("/");
    } catch {
      alert("Could not save profile. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-muted/30 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 max-w-md mx-auto w-full">

        <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
          <Leaf className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-1">Welcome to Smart Fasal</h1>
        <p className="text-muted-foreground text-sm mb-8 text-center">
          Let's set up your farmer profile — it only takes a minute.
        </p>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 rounded-full flex-1 transition-all ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 1 && (
          <Card className="w-full">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Personal Details</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input id="fullName" placeholder="e.g. Ramesh Kumar" value={form.fullName} onChange={e => set("fullName", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" placeholder="e.g. 9876543210" value={form.phone} onChange={e => set("phone", e.target.value)} type="tel" />
              </div>
              <Button className="w-full" disabled={!form.fullName.trim()} onClick={() => setStep(2)}>
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="w-full">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Farm Location</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="village">Village / Town</Label>
                <Input id="village" placeholder="e.g. Nagpur Village" value={form.village} onChange={e => set("village", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="district">District</Label>
                <Input id="district" placeholder="e.g. Nagpur" value={form.district} onChange={e => set("district", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state">State</Label>
                <select
                  id="state"
                  value={form.state}
                  onChange={e => set("state", e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">Select state...</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="w-full">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Sprout className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Farm Details</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="farmSize">Farm Size (in acres)</Label>
                <Input id="farmSize" placeholder="e.g. 5" value={form.farmSizeAcres} onChange={e => set("farmSizeAcres", e.target.value)} type="number" min="0" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="crop">Primary Crop</Label>
                <select
                  id="crop"
                  value={form.primaryCrop}
                  onChange={e => set("primaryCrop", e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                >
                  <option value="">Select crop...</option>
                  {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="experience">Farming Experience (years)</Label>
                <Input id="experience" placeholder="e.g. 10" value={form.farmingExperienceYears} onChange={e => set("farmingExperienceYears", e.target.value)} type="number" min="0" />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                <Button className="flex-1" onClick={handleFinish} disabled={isPending}>
                  {isPending ? "Saving..." : "Finish Setup"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
