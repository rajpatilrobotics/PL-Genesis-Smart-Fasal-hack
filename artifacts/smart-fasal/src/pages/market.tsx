import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Store, MapPin, Tag, ShoppingBag,
  PlusCircle, Lock, CheckCircle2, FileText, Image, ExternalLink, RefreshCw
} from "lucide-react";
import {
  useGetMarketPrices, getGetMarketPricesQueryKey,
  useGetMarketListings, getGetMarketListingsQueryKey,
  useGetProductRecommendations, getGetProductRecommendationsQueryKey,
  useCreateMarketListing, useBuyMarketListing, useConfirmDelivery,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const IPFS_GATEWAY = "https://gateway.lighthouse.storage/ipfs/";

function cidToUrl(cid: string | null | undefined): string | null {
  if (!cid) return null;
  return `${IPFS_GATEWAY}${cid}`;
}

function truncateCid(cid: string) {
  return `${cid.slice(0, 10)}...${cid.slice(-6)}`;
}

function EscrowBadge({ status }: { status: string }) {
  if (status === "none") return null;
  if (status === "escrowed") {
    return (
      <Badge className="bg-amber-500/20 text-amber-700 border-amber-300 flex items-center gap-1 text-[10px]">
        <Lock className="w-3 h-3" /> Funds in Escrow
      </Badge>
    );
  }
  if (status === "released") {
    return (
      <Badge className="bg-green-500/20 text-green-700 border-green-300 flex items-center gap-1 text-[10px]">
        <CheckCircle2 className="w-3 h-3" /> Escrow Released
      </Badge>
    );
  }
  return null;
}

function ProtocolLabsBadge({ cid, label }: { cid: string; label: string }) {
  return (
    <a
      href={cidToUrl(cid) ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 transition-colors"
    >
      <span className="font-semibold">⬡ IPFS</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono">{truncateCid(cid)}</span>
      <ExternalLink className="w-2.5 h-2.5" />
    </a>
  );
}

export default function Market() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listingOpen, setListingOpen] = useState(false);
  const [buyDialogId, setBuyDialogId] = useState<number | null>(null);
  const [buyerNameInput, setBuyerNameInput] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [listingForm, setListingForm] = useState({
    title: "", description: "", crop: "", price: "", quantity: "",
    unit: "kg", sellerName: "", location: "", imageBase64: "",
  });

  const { data: prices, isLoading: loadingPrices, refetch: refetchPrices } = useGetMarketPrices({
    query: { queryKey: getGetMarketPricesQueryKey() }
  });

  const { data: listings, isLoading: loadingListings } = useGetMarketListings({
    query: { queryKey: getGetMarketListingsQueryKey() }
  });

  const { data: products, isLoading: loadingProducts } = useGetProductRecommendations({
    query: { queryKey: getGetProductRecommendationsQueryKey() }
  });

  const createListing = useCreateMarketListing();
  const buyListing = useBuyMarketListing();
  const confirmDelivery = useConfirmDelivery();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setPreviewImage(base64);
      setListingForm(f => ({ ...f, imageBase64: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault();
    createListing.mutate({
      data: {
        ...listingForm,
        price: Number(listingForm.price),
        quantity: Number(listingForm.quantity),
        imageBase64: listingForm.imageBase64 || undefined,
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Listing Created on IPFS",
          description: "Your produce listing is stored permanently on IPFS (Protocol Labs).",
        });
        setListingOpen(false);
        setPreviewImage(null);
        setListingForm({ title: "", description: "", crop: "", price: "", quantity: "", unit: "kg", sellerName: "", location: "", imageBase64: "" });
        queryClient.invalidateQueries({ queryKey: getGetMarketListingsQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to create listing.", variant: "destructive" }),
    });
  };

  const handleBuy = () => {
    if (buyDialogId == null) return;
    buyListing.mutate(
      { id: buyDialogId, data: { buyerName: buyerNameInput || "Anonymous Buyer" } },
      {
        onSuccess: () => {
          toast({
            title: "Funds Locked in Escrow",
            description: "Payment held on Filecoin FVM escrow. Release after delivery confirmation.",
          });
          setBuyDialogId(null);
          setBuyerNameInput("");
          queryClient.invalidateQueries({ queryKey: getGetMarketListingsQueryKey() });
        },
        onError: () => toast({ title: "Error", description: "Purchase failed.", variant: "destructive" }),
      }
    );
  };

  const handleConfirmDelivery = (id: number) => {
    confirmDelivery.mutate({ id }, {
      onSuccess: (data) => {
        toast({
          title: "Delivery Confirmed — Escrow Released!",
          description: `Filecoin receipt: ${data.receiptCid ? truncateCid(data.receiptCid) : "stored"}`,
        });
        queryClient.invalidateQueries({ queryKey: getGetMarketListingsQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Confirmation failed.", variant: "destructive" }),
    });
  };

  const selectedListing = listings?.find(l => l.id === buyDialogId);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Marketplace</h2>
          <p className="text-muted-foreground text-sm">Live prices · IPFS listings · Filecoin escrow</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-blue-600 font-medium bg-blue-50 border border-blue-200 rounded-full px-2 py-1">
          <span>⬡</span> Powered by Protocol Labs
        </div>
      </div>

      <Tabs defaultValue="mandi" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 h-auto p-1">
          <TabsTrigger value="mandi" className="py-2 text-xs">Mandi Prices</TabsTrigger>
          <TabsTrigger value="p2p" className="py-2 text-xs">P2P Trade</TabsTrigger>
          <TabsTrigger value="products" className="py-2 text-xs">Agri Inputs</TabsTrigger>
        </TabsList>

        {/* ── MANDI PRICES ─────────────────────────────────────────────── */}
        <TabsContent value="mandi" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">eNAM-sourced · refreshes every 60s</p>
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => { queryClient.invalidateQueries({ queryKey: getGetMarketPricesQueryKey() }); refetchPrices(); }}
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {loadingPrices
              ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
              : prices?.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex border-l-4 border-primary">
                      <div className="p-4 flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-lg">{item.crop}</h3>
                          <div className={`flex items-center text-sm font-bold ${item.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {item.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                            {Math.abs(item.change)}%
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-2xl font-black">₹{item.price}</span>
                          <span className="text-sm text-muted-foreground">/ {item.unit}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center"><Store className="w-3 h-3 mr-1" />{item.market}</span>
                          <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" />{item.state}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* ── P2P TRADE ──────────────────────────────────────────────────── */}
        <TabsContent value="p2p" className="space-y-4">
          {/* Info banner */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 space-y-1">
            <p className="font-semibold flex items-center gap-1">⬡ Protocol Labs Web3 Market</p>
            <p>Photos stored on <strong>IPFS</strong> · Listings on <strong>Filecoin</strong> · Escrow via <strong>FVM</strong> · Receipts permanent on-chain</p>
          </div>

          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Direct from Farmers</h3>
            <Dialog open={listingOpen} onOpenChange={setListingOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><PlusCircle className="w-4 h-4 mr-1" /> Sell Produce</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create IPFS-Backed Listing</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-1">Your listing & photo will be stored permanently on IPFS via Lighthouse (Protocol Labs)</p>
                </DialogHeader>
                <form onSubmit={handleCreateListing} className="space-y-4 pt-2">
                  {/* Photo upload */}
                  <div className="space-y-2">
                    <Label>Produce Photo (stored on IPFS)</Label>
                    <div
                      className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {previewImage ? (
                        <img src={previewImage} alt="Preview" className="mx-auto max-h-32 object-cover rounded" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Image className="w-8 h-8" />
                          <span className="text-xs">Click to upload photo</span>
                          <span className="text-[10px]">Stored permanently on IPFS</span>
                        </div>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  </div>

                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input required value={listingForm.title} onChange={e => setListingForm({ ...listingForm, title: e.target.value })} placeholder="e.g. Organic Basmati Wheat" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={listingForm.description} onChange={e => setListingForm({ ...listingForm, description: e.target.value })} placeholder="Grade, quality details..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Crop</Label>
                      <Input required value={listingForm.crop} onChange={e => setListingForm({ ...listingForm, crop: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Price (₹)</Label>
                      <Input type="number" required value={listingForm.price} onChange={e => setListingForm({ ...listingForm, price: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input type="number" required value={listingForm.quantity} onChange={e => setListingForm({ ...listingForm, quantity: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Input required value={listingForm.unit} onChange={e => setListingForm({ ...listingForm, unit: e.target.value })} placeholder="kg, quintal" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Your Name</Label>
                    <Input required value={listingForm.sellerName} onChange={e => setListingForm({ ...listingForm, sellerName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input required value={listingForm.location} onChange={e => setListingForm({ ...listingForm, location: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createListing.isPending}>
                    {createListing.isPending ? "Uploading to IPFS..." : "⬡ Post on IPFS + Filecoin"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Buy escrow dialog */}
          <Dialog open={buyDialogId != null} onOpenChange={(open) => { if (!open) setBuyDialogId(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Lock Funds in FVM Escrow</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Your payment will be held in a Filecoin FVM escrow smart contract. Released to the seller only after you confirm delivery.
                </p>
              </DialogHeader>
              {selectedListing && (
                <div className="space-y-4 pt-2">
                  <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                    <p className="font-semibold">{selectedListing.title}</p>
                    <p className="text-muted-foreground">{selectedListing.quantity} {selectedListing.unit} of {selectedListing.crop}</p>
                    <p className="text-primary font-bold text-lg">₹{(selectedListing.price * selectedListing.quantity).toLocaleString()}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Your Name (Buyer)</Label>
                    <Input
                      value={buyerNameInput}
                      onChange={e => setBuyerNameInput(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                    <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>Escrow agreement will be stored permanently on <strong>IPFS</strong> as a verifiable record.</span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleBuy}
                    disabled={buyListing.isPending}
                  >
                    {buyListing.isPending ? "Creating Escrow..." : "⬡ Lock in Filecoin Escrow"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Listings */}
          <div className="grid grid-cols-1 gap-4">
            {loadingListings
              ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
              : listings?.length === 0
                ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No listings yet. Be the first to sell!</p>
                  </div>
                )
                : listings?.map((listing) => (
                  <Card key={listing.id} className="overflow-hidden border-border relative">
                    {/* IPFS Photo */}
                    {listing.imageCid && (
                      <div className="h-40 w-full overflow-hidden bg-muted">
                        <img
                          src={`${IPFS_GATEWAY}${listing.imageCid}`}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    )}

                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base leading-tight mb-1 truncate">{listing.title}</CardTitle>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[10px]">{listing.crop}</Badge>
                            <EscrowBadge status={listing.escrowStatus} />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xl font-bold text-primary">₹{listing.price}</p>
                          <p className="text-xs text-muted-foreground">per {listing.unit}</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 space-y-2">
                      <div className="flex justify-between text-sm">
                        <div className="space-y-0.5">
                          <p className="flex items-center text-muted-foreground text-xs"><UserIcon className="w-3 h-3 mr-1" />{listing.sellerName}</p>
                          <p className="flex items-center text-muted-foreground text-xs"><MapPin className="w-3 h-3 mr-1" />{listing.location}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Available</p>
                          <p className="font-bold text-sm">{listing.quantity} {listing.unit}</p>
                        </div>
                      </div>

                      {/* IPFS / Filecoin CID badges */}
                      <div className="space-y-1 pt-1 border-t border-muted">
                        {listing.imageCid && (
                          <ProtocolLabsBadge cid={listing.imageCid} label="photo" />
                        )}
                        {listing.receiptCid && listing.escrowStatus === "escrowed" && (
                          <div className="flex items-center gap-1">
                            <ProtocolLabsBadge cid={listing.receiptCid} label="escrow" />
                          </div>
                        )}
                        {listing.receiptCid && listing.escrowStatus === "released" && (
                          <div className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-green-600" />
                            <ProtocolLabsBadge cid={listing.receiptCid} label="receipt" />
                          </div>
                        )}
                      </div>

                      {listing.buyerName && (
                        <p className="text-xs text-muted-foreground">Buyer: <span className="font-medium text-foreground">{listing.buyerName}</span></p>
                      )}
                    </CardContent>

                    <CardFooter className="p-4 pt-0 gap-2">
                      {listing.status !== "sold" ? (
                        <Button
                          className="w-full"
                          onClick={() => setBuyDialogId(listing.id)}
                          disabled={buyListing.isPending}
                        >
                          <Lock className="w-3.5 h-3.5 mr-1.5" /> Buy with Escrow
                        </Button>
                      ) : listing.escrowStatus === "escrowed" ? (
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => handleConfirmDelivery(listing.id)}
                          disabled={confirmDelivery.isPending}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          {confirmDelivery.isPending ? "Minting Receipt..." : "Confirm Delivery & Release Escrow"}
                        </Button>
                      ) : listing.escrowStatus === "released" ? (
                        <div className="w-full text-center text-xs text-green-600 font-medium flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Trade Complete · Receipt on Filecoin
                        </div>
                      ) : (
                        <Button className="w-full" variant="secondary" disabled>Unavailable</Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
          </div>
        </TabsContent>

        {/* ── AGRI INPUTS ─────────────────────────────────────────────────── */}
        <TabsContent value="products" className="space-y-4">
          <div className="bg-accent/10 p-3 rounded-lg border border-accent/20 mb-4">
            <p className="text-sm text-accent-foreground font-medium flex items-center">
              <Tag className="w-4 h-4 mr-2" /> AI-recommended inputs based on your soil profile
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {loadingProducts
              ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
              : products?.map((prod) => (
                <Card key={prod.id} className="flex flex-col h-full">
                  <CardHeader className="p-3 pb-0">
                    <Badge className="w-fit mb-2 text-[10px] uppercase">{prod.category}</Badge>
                    <CardTitle className="text-sm leading-tight">{prod.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-2 flex-grow">
                    <p className="text-lg font-bold">₹{prod.price}</p>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{prod.reason}</p>
                  </CardContent>
                  <CardFooter className="p-3 pt-0 mt-auto">
                    <Button size="sm" variant="outline" className="w-full text-xs h-8">
                      <ShoppingBag className="w-3 h-3 mr-1" /> View
                    </Button>
                  </CardFooter>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
