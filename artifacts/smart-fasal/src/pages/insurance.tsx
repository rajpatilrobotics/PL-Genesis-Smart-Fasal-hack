import { useGetInsuranceRisk, getGetInsuranceRiskQueryKey, useGetInsuranceClaims, getGetInsuranceClaimsQueryKey, useCreateInsuranceClaim } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, ShieldCheck, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function Insurance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimForm, setClaimForm] = useState({ type: "DROUGHT", description: "" });

  const { data: risk, isLoading: loadingRisk } = useGetInsuranceRisk({
    query: { queryKey: getGetInsuranceRiskQueryKey() }
  });

  const { data: claims, isLoading: loadingClaims } = useGetInsuranceClaims({
    query: { queryKey: getGetInsuranceClaimsQueryKey() }
  });

  const createClaim = useCreateInsuranceClaim();

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClaim.mutate({
      data: {
        claimType: claimForm.type,
        description: claimForm.description
      }
    }, {
      onSuccess: () => {
        toast({ title: "Claim Submitted", description: "Your insurance claim has been registered." });
        setClaimOpen(false);
        setClaimForm({ type: "DROUGHT", description: "" });
        queryClient.invalidateQueries({ queryKey: getGetInsuranceClaimsQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to submit claim.", variant: "destructive" });
      }
    });
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'text-green-600 bg-green-50 border-green-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'HIGH': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Parametric Insurance</h2>
        <p className="text-muted-foreground text-sm">Automated protection against climate risks</p>
      </div>

      {/* Risk Assessment Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            Current Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRisk ? (
            <Skeleton className="h-32 w-full" />
          ) : risk ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border flex items-center justify-between ${getRiskColor(risk.riskLevel)}`}>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider opacity-80">Risk Level</p>
                  <p className="text-2xl font-black">{risk.riskLevel}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold uppercase tracking-wider opacity-80">Score</p>
                  <p className="text-2xl font-black">{risk.riskScore}/100</p>
                </div>
              </div>

              {risk.reasons && risk.reasons.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                    <AlertCircle className="w-4 h-4" /> Risk Triggers
                  </p>
                  <ul className="text-sm space-y-1.5">
                    {risk.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {risk.recommendations && risk.recommendations.length > 0 && (
                <div className="space-y-2 mt-4 bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Recommendations
                  </p>
                  <ul className="text-sm space-y-1.5 text-muted-foreground">
                    {risk.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">Risk data unavailable</div>
          )}
        </CardContent>
        <CardFooter>
          {risk?.eligibleForClaim && (
            <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
              <DialogTrigger asChild>
                <Button className="w-full font-bold" size="lg" variant="destructive" data-testid="button-open-claim">
                  Claim Insurance (Eligible)
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>File Parametric Claim</DialogTitle>
                  <DialogDescription>
                    Your farm conditions have triggered an automated payout eligibility.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleClaimSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Trigger Event</Label>
                    <Select value={claimForm.type} onValueChange={(val) => setClaimForm({...claimForm, type: val})}>
                      <SelectTrigger data-testid="select-claim-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DROUGHT">Drought / Low Moisture</SelectItem>
                        <SelectItem value="FLOOD">Excessive Rainfall</SelectItem>
                        <SelectItem value="HEATWAVE">Extreme Heat</SelectItem>
                        <SelectItem value="DISEASE">Pest/Disease Outbreak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Additional Details</Label>
                    <Textarea 
                      placeholder="Describe the impact on your crops..." 
                      value={claimForm.description}
                      onChange={e=>setClaimForm({...claimForm, description: e.target.value})}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createClaim.isPending} data-testid="button-submit-claim">
                    {createClaim.isPending ? "Submitting..." : "Submit Claim"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardFooter>
      </Card>

      {/* Claims History */}
      <div>
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Claims History
        </h3>
        
        {loadingClaims ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : claims && claims.length > 0 ? (
          <div className="space-y-3">
            {claims.map((claim) => (
              <Card key={claim.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-sm">{claim.claimType} EVENT</p>
                      <p className="text-xs text-muted-foreground">{new Date(claim.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={claim.status === 'APPROVED' ? 'default' : claim.status === 'PENDING' ? 'secondary' : 'outline'}>
                      {claim.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{claim.description}</p>
                  {claim.status === 'APPROVED' && (
                    <div className="mt-3 bg-accent/10 text-accent-foreground p-2 rounded text-xs font-semibold flex justify-between items-center">
                      <span>Reward Payout</span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        +{claim.rewardPoints} points
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No insurance claims filed yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
