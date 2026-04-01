import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Store, MapPin, Tag, ShoppingBag, PlusCircle } from "lucide-react";
import { 
  useGetMarketPrices, getGetMarketPricesQueryKey,
  useGetMarketListings, getGetMarketListingsQueryKey,
  useGetProductRecommendations, getGetProductRecommendationsQueryKey,
  useCreateMarketListing, useBuyMarketListing
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Market() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [listingOpen, setListingOpen] = useState(false);
  const [listingForm, setListingForm] = useState({
    title: "", description: "", crop: "", price: "", quantity: "", unit: "kg", sellerName: "", location: ""
  });

  const { data: prices, isLoading: loadingPrices } = useGetMarketPrices({
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

  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault();
    createListing.mutate({
      data: {
        ...listingForm,
        price: Number(listingForm.price),
        quantity: Number(listingForm.quantity),
      }
    }, {
      onSuccess: () => {
        toast({ title: "Listing Created", description: "Your produce is now live on the P2P market." });
        setListingOpen(false);
        queryClient.invalidateQueries({ queryKey: getGetMarketListingsQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create listing.", variant: "destructive" });
      }
    });
  };

  const handleBuy = (id: number) => {
    buyListing.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Purchase Successful", description: "Seller will contact you shortly." });
        queryClient.invalidateQueries({ queryKey: getGetMarketListingsQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Purchase failed.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Marketplace</h2>
          <p className="text-muted-foreground text-sm">Live prices & P2P trading</p>
        </div>
      </div>

      <Tabs defaultValue="mandi" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 h-auto p-1">
          <TabsTrigger value="mandi" className="py-2 text-xs" data-testid="tab-mandi">Mandi Prices</TabsTrigger>
          <TabsTrigger value="p2p" className="py-2 text-xs" data-testid="tab-p2p">P2P Trade</TabsTrigger>
          <TabsTrigger value="products" className="py-2 text-xs" data-testid="tab-products">Agri Inputs</TabsTrigger>
        </TabsList>

        {/* MANDI PRICES TAB */}
        <TabsContent value="mandi" className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {loadingPrices ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : prices?.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex border-l-4 border-primary">
                    <div className="p-4 flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-lg">{item.crop}</h3>
                        <div className={`flex items-center text-sm font-bold ${item.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                          {Math.abs(item.change)}%
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-black">₹{item.price}</span>
                        <span className="text-sm text-muted-foreground">/ {item.unit}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center"><Store className="w-3 h-3 mr-1" /> {item.market}</span>
                        <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {item.state}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* P2P LISTINGS TAB */}
        <TabsContent value="p2p" className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Direct from Farmers</h3>
            <Dialog open={listingOpen} onOpenChange={setListingOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-new-listing">
                  <PlusCircle className="w-4 h-4 mr-1" /> Sell Produce
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Listing</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateListing} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input required value={listingForm.title} onChange={e=>setListingForm({...listingForm, title: e.target.value})} placeholder="e.g. Organic Basmati Wheat" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Crop</Label>
                      <Input required value={listingForm.crop} onChange={e=>setListingForm({...listingForm, crop: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Price (₹)</Label>
                      <Input type="number" required value={listingForm.price} onChange={e=>setListingForm({...listingForm, price: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input type="number" required value={listingForm.quantity} onChange={e=>setListingForm({...listingForm, quantity: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <Input required value={listingForm.unit} onChange={e=>setListingForm({...listingForm, unit: e.target.value})} placeholder="kg, quintal" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Seller Name</Label>
                    <Input required value={listingForm.sellerName} onChange={e=>setListingForm({...listingForm, sellerName: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input required value={listingForm.location} onChange={e=>setListingForm({...listingForm, location: e.target.value})} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createListing.isPending} data-testid="button-submit-listing">
                    {createListing.isPending ? "Posting..." : "Post Listing"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {loadingListings ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
            ) : listings?.map((listing) => (
              <Card key={listing.id} className="overflow-hidden border-border relative">
                {listing.status === 'SOLD' && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex items-center justify-center">
                    <Badge variant="secondary" className="text-lg py-1 px-4 border-2">SOLD OUT</Badge>
                  </div>
                )}
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg leading-tight mb-1">{listing.title}</CardTitle>
                      <Badge variant="outline" className="text-xs">{listing.crop}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-primary">₹{listing.price}</p>
                      <p className="text-xs text-muted-foreground">per {listing.unit}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="flex justify-between text-sm mt-2">
                    <div className="space-y-1">
                      <p className="flex items-center text-muted-foreground"><Users className="w-3 h-3 mr-1" /> {listing.sellerName}</p>
                      <p className="flex items-center text-muted-foreground"><MapPin className="w-3 h-3 mr-1" /> {listing.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="font-bold">{listing.quantity} {listing.unit}</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button 
                    className="w-full" 
                    variant={listing.status === 'SOLD' ? 'secondary' : 'default'}
                    disabled={listing.status === 'SOLD' || buyListing.isPending}
                    onClick={() => handleBuy(listing.id)}
                    data-testid={`button-buy-${listing.id}`}
                  >
                    {listing.status === 'SOLD' ? 'Unavailable' : 'Buy Now'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* AI PRODUCTS TAB */}
        <TabsContent value="products" className="space-y-4">
          <div className="bg-accent/10 p-3 rounded-lg border border-accent/20 mb-4">
            <p className="text-sm text-accent-foreground font-medium flex items-center">
              <Tag className="w-4 h-4 mr-2" /> AI recommended inputs based on your soil profile
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {loadingProducts ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
            ) : products?.map((prod) => (
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

// Temporary icon fix for Market tab
function Users(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
