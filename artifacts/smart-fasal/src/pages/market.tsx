import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Store, MapPin, Tag, ShoppingBag,
  PlusCircle, Lock, CheckCircle2, FileText, Image, ExternalLink,
  RefreshCw, Search, Star, User, Package, Leaf, Droplets,
  Shield, Database, CloudUpload, ArrowRight
} from "lucide-react";
import {
  useGetMarketPrices, getGetMarketPricesQueryKey,
  useGetMarketListings, getGetMarketListingsQueryKey,
  useGetProductRecommendations, getGetProductRecommendationsQueryKey,
  useCreateMarketListing, useBuyMarketListing, useConfirmDelivery,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const IPFS_GATEWAY = "https://gateway.lighthouse.storage/ipfs/";

function cidToUrl(cid: string | null | undefined): string | null {
  if (!cid) return null;
  return `${IPFS_GATEWAY}${cid}`;
}

const PRODUCT_BUY_LINKS: Record<number, { label: string; url: string; color: string }[]> = {
  1: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=IFFCO+DAP+fertilizer+50kg", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=IFFCO+DAP+fertilizer+50kg", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  2: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=KRIBHCO+Urea+neem+coated+50kg", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=neem+coated+urea+50kg", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  3: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=NPK+12-32-16+fertilizer+Coromandel", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=NPK+12+32+16+fertilizer", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  4: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=zinc+sulphate+fertilizer+1kg+GSFC", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=zinc+sulphate+fertilizer+1kg", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  5: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=Bio+NPK+liquid+fertilizer+PGPR", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=bio+NPK+liquid+fertilizer", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  6: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=humic+acid+granules+5kg+fertilizer", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=humic+acid+granules+fertilizer", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  7: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=neem+oil+organic+1L+azadirachtin+pesticide", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=neem+oil+organic+1+litre", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  8: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=Chlorpyrifos+20EC+500ml+Bayer+insecticide", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=Chlorpyrifos+insecticide+Bayer", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  9: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=Mancozeb+75WP+500g+UPL+fungicide", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=Mancozeb+fungicide+UPL", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  10: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=Trichoderma+powder+1kg+bio+fungicide", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=trichoderma+powder+bio+fungicide", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  11: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=Wheat+HD+2967+certified+seeds+IARI", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=HD-2967+wheat+certified+seeds", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  12: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=Namdhari+tomato+F1+hybrid+seeds", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=Namdhari+tomato+F1+hybrid+seeds", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  13: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=Moong+Pusa+Vishal+seeds+1kg", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=Moong+Pusa+Vishal+seeds", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  14: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=Jain+drip+irrigation+kit+1+acre", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=drip+irrigation+kit+1+acre+Jain", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  15: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=Netafim+mini+sprinkler+irrigation+set", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=sprinkler+irrigation+set+1+acre", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  16: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=soil+moisture+sensor+kit+4G+data+logger+agriculture", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=soil+moisture+sensor+iot+agriculture", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  17: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=agricultural+lime+calcitic+50kg+soil+pH", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=agricultural+lime+soil+amendment+50kg", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
  18: [
    { label: "Amazon", url: "https://www.amazon.in/s?k=vermicompost+25kg+organic+fertilizer", color: "bg-[#FF9900] hover:bg-[#e68a00] text-black" },
    { label: "Flipkart", url: "https://www.flipkart.com/search?q=vermicompost+25kg+organic", color: "bg-[#2874F0] hover:bg-[#1a5fd4] text-white" },
  ],
};

function truncateCid(cid: string) {
  if (cid.length <= 16) return cid;
  return `${cid.slice(0, 8)}…${cid.slice(-6)}`;
}

const PRICE_CATEGORIES = ["All", "Cereals", "Pulses", "Vegetables", "Oil Seeds", "Cash Crops", "Fruits"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Cereals: "bg-amber-50 text-amber-700 border-amber-200",
  Pulses: "bg-orange-50 text-orange-700 border-orange-200",
  Vegetables: "bg-green-50 text-green-700 border-green-200",
  "Oil Seeds": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Cash Crops": "bg-blue-50 text-blue-700 border-blue-200",
  Fruits: "bg-pink-50 text-pink-700 border-pink-200",
  Fertilizer: "bg-lime-50 text-lime-700 border-lime-200",
  Pesticide: "bg-red-50 text-red-700 border-red-200",
  Seeds: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Irrigation: "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Soil Treatment": "bg-stone-50 text-stone-700 border-stone-200",
};

const PRODUCT_CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Fertilizer: <Leaf className="w-3.5 h-3.5" />,
  Pesticide: <Shield className="w-3.5 h-3.5" />,
  Seeds: <Package className="w-3.5 h-3.5" />,
  Irrigation: <Droplets className="w-3.5 h-3.5" />,
  "Soil Treatment": <Database className="w-3.5 h-3.5" />,
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
      ))}
      <span className="text-[10px] text-gray-400 ml-0.5">{rating.toFixed(1)}</span>
    </div>
  );
}

function EscrowBadge({ status }: { status: string }) {
  if (status === "none") return null;
  if (status === "escrowed") return (
    <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 flex items-center gap-1 text-[10px] h-5">
      <Lock className="w-2.5 h-2.5" /> Funds in Escrow
    </Badge>
  );
  if (status === "released") return (
    <Badge className="bg-green-500/15 text-green-700 border-green-300 flex items-center gap-1 text-[10px] h-5">
      <CheckCircle2 className="w-2.5 h-2.5" /> Escrow Released
    </Badge>
  );
  return null;
}

function ProtocolBadge({ cid, label, icon }: { cid: string; label: string; icon?: React.ReactNode }) {
  return (
    <a
      href={cidToUrl(cid) ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 hover:underline transition-colors font-mono bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5"
    >
      {icon ?? <span>⬡</span>}
      <span className="not-italic font-medium">{label}:</span>
      <span>{truncateCid(cid)}</span>
      <ExternalLink className="w-2.5 h-2.5" />
    </a>
  );
}

function DataProvenanceTrail({ listing }: { listing: { imageCid?: string | null; receiptCid?: string | null; escrowStatus: string } }) {
  const steps: { label: string; cid: string | null | undefined; icon: React.ReactNode; done: boolean }[] = [
    { label: "Photo on IPFS", cid: listing.imageCid, icon: <CloudUpload className="w-3 h-3" />, done: !!listing.imageCid },
    { label: "Escrow on Filecoin", cid: listing.escrowStatus === "escrowed" ? listing.receiptCid : null, icon: <Lock className="w-3 h-3" />, done: listing.escrowStatus === "escrowed" || listing.escrowStatus === "released" },
    { label: "Trade Receipt", cid: listing.escrowStatus === "released" ? listing.receiptCid : null, icon: <FileText className="w-3 h-3" />, done: listing.escrowStatus === "released" },
  ];
  if (!steps.some(s => s.done)) return null;
  return (
    <div className="pt-2 border-t border-white/40 space-y-1">
      <p className="text-[10px] font-semibold text-blue-700 flex items-center gap-1 uppercase tracking-wide">
        <span>⬡</span> Protocol Labs Data Trail
      </p>
      <div className="flex flex-wrap gap-1">
        {steps.map((step, i) => (
          step.done && (
            <div key={i} className="flex items-center gap-1">
              {step.cid ? (
                <ProtocolBadge cid={step.cid} label={step.label} icon={step.icon} />
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                  {step.icon} {step.label} ✓
                </span>
              )}
              {i < steps.length - 1 && step.done && <ArrowRight className="w-2.5 h-2.5 text-gray-300" />}
            </div>
          )
        ))}
      </div>
    </div>
  );
}

const glassCard = "glass-glow-amber rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl hover:bg-white/45";

function MandiPriceCard({ item }: { item: { id: number; crop: string; price: number; unit: string; market: string; state: string; change: number; category?: string | null } }) {
  const up = item.change >= 0;
  return (
    <div className={cn(glassCard, "overflow-hidden transition-all duration-200 hover:-translate-y-0.5")}>
      <div className={`flex border-l-4 rounded-r-2xl ${up ? "border-emerald-500" : "border-red-500"}`}>
        <div className="p-3.5 flex-1">
          <div className="flex justify-between items-start mb-1.5">
            <div>
              <h3 className="font-bold text-sm leading-tight text-gray-800">{item.crop}</h3>
              {item.category && (
                <span className={`inline-block text-[9px] font-medium border rounded-full px-1.5 py-0 mt-0.5 ${CATEGORY_COLORS[item.category] ?? "bg-white/40 text-gray-600"}`}>
                  {item.category}
                </span>
              )}
            </div>
            <div className={`flex items-center gap-0.5 text-xs font-bold bg-white/40 backdrop-blur-sm rounded-full px-2 py-0.5 ${up ? "text-emerald-600" : "text-red-600"}`}>
              {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {Math.abs(item.change)}%
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-2xl font-black text-amber-700">₹{item.price.toLocaleString("en-IN")}</span>
            <span className="text-xs text-gray-500">{item.unit}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-0.5"><Store className="w-3 h-3" />{item.market}</span>
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{item.state}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListingCard({
  listing, onBuy, onConfirm, isBuying, isConfirming,
}: {
  listing: {
    id: number; title: string; description: string; crop: string; price: number;
    quantity: number; unit: string; sellerName: string; location: string;
    status: string; imageCid?: string | null; imageUrl?: string | null;
    receiptCid?: string | null; escrowStatus: string; buyerName?: string | null;
    rating?: number | null; category?: string | null; createdAt: Date;
  };
  onBuy: () => void; onConfirm: () => void; isBuying: boolean; isConfirming: boolean;
}) {
  const imgSrc = listing.imageCid ? `${IPFS_GATEWAY}${listing.imageCid}` : listing.imageUrl;
  return (
    <div className={cn(glassCard, "overflow-hidden flex flex-col")}>
      {imgSrc && (
        <div className="h-44 w-full overflow-hidden relative rounded-t-2xl">
          <img src={imgSrc} alt={listing.title} className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          {listing.imageCid && (
            <div className="absolute top-2 right-2">
              <span className="text-[9px] bg-blue-900/80 text-blue-100 rounded-full px-2 py-0.5 flex items-center gap-1">⬡ IPFS</span>
            </div>
          )}
          {listing.status === "sold" && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="bg-white/90 text-gray-800 text-xs font-bold px-3 py-1 rounded-full">
                {listing.escrowStatus === "released" ? "Trade Complete" : "In Escrow"}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="p-3.5 pb-2 flex-1">
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-snug mb-1.5 line-clamp-2 text-gray-800">{listing.title}</p>
            <div className="flex flex-wrap gap-1 items-center">
              <Badge variant="outline" className={`text-[10px] h-4 px-1.5 border ${CATEGORY_COLORS[listing.category ?? ""] ?? ""}`}>
                {listing.crop}
              </Badge>
              <EscrowBadge status={listing.escrowStatus} />
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-black text-amber-700">₹{listing.price.toLocaleString("en-IN")}</p>
            <p className="text-[11px] text-gray-500">per {listing.unit}</p>
          </div>
        </div>

        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{listing.description}</p>

        <div className="flex justify-between items-center text-xs mb-2">
          <div className="space-y-0.5">
            <p className="flex items-center text-gray-500 gap-0.5"><User className="w-3 h-3" />{listing.sellerName}</p>
            <p className="flex items-center text-gray-500 gap-0.5"><MapPin className="w-3 h-3" />{listing.location}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-[10px]">Available</p>
            <p className="font-bold text-gray-800">{listing.quantity} {listing.unit}</p>
            {listing.rating && <StarRating rating={listing.rating} />}
          </div>
        </div>

        {listing.buyerName && (
          <p className="text-[11px] text-gray-500 mb-2">Buyer: <span className="font-medium text-gray-800">{listing.buyerName}</span></p>
        )}

        <DataProvenanceTrail listing={listing} />
      </div>

      <div className="p-3.5 pt-0">
        {listing.status !== "sold" ? (
          <Button className="w-full h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white" onClick={onBuy} disabled={isBuying}>
            <Lock className="w-3 h-3" /> {isBuying ? "Creating Escrow…" : "Buy with Filecoin Escrow"}
          </Button>
        ) : listing.escrowStatus === "escrowed" ? (
          <Button className="w-full h-8 text-xs gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-50" variant="outline" onClick={onConfirm} disabled={isConfirming}>
            <CheckCircle2 className="w-3 h-3" />
            {isConfirming ? "Minting Receipt…" : "Confirm Delivery & Release Escrow"}
          </Button>
        ) : listing.escrowStatus === "released" ? (
          <div className="w-full text-center text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1 py-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Trade Complete · Permanent Filecoin Receipt
          </div>
        ) : (
          <Button className="w-full h-8 text-xs" variant="secondary" disabled>Sold</Button>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product }: {
  product: { id: number; name: string; category: string; description: string; price: number; reason: string; rating: number }
}) {
  const { toast } = useToast();
  return (
    <div className={cn(glassCard, "overflow-hidden flex flex-col p-3.5")}>
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="flex-1">
          <p className="font-bold text-sm leading-tight mb-1 text-gray-800">{product.name}</p>
          <span className={`inline-flex items-center gap-1 text-[10px] border rounded-full px-1.5 py-0 font-medium ${CATEGORY_COLORS[product.category] ?? "bg-white/40 text-gray-600"}`}>
            {PRODUCT_CATEGORY_ICONS[product.category]}
            {product.category}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-black text-amber-700">₹{product.price.toLocaleString("en-IN")}</p>
        </div>
      </div>

      <StarRating rating={product.rating} />
      <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3 mt-1.5 mb-2">{product.description}</p>

      <div className="rounded-xl bg-amber-50/60 border border-amber-200/60 px-2 py-1.5 mb-3">
        <p className="text-[10px] text-amber-800 flex items-start gap-1">
          <Tag className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
          <span className="italic">{product.reason}</span>
        </p>
      </div>

      {PRODUCT_BUY_LINKS[product.id] && (
        <div className="mb-2">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">Buy Online</p>
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_BUY_LINKS[product.id].map(link => (
              <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${link.color}`}>
                {link.label}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>
      )}
      <Button variant="outline" className="w-full h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
        onClick={() => toast({ title: "Added to Cart", description: `${product.name} — ₹${product.price.toLocaleString("en-IN")}` })}>
        <ShoppingBag className="w-3 h-3 mr-1" /> Add to Cart
      </Button>
    </div>
  );
}

export default function Market() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listingOpen, setListingOpen] = useState(false);
  const [buyDialogId, setBuyDialogId] = useState<number | null>(null);
  const [buyerNameInput, setBuyerNameInput] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [priceCategory, setPriceCategory] = useState<string>("All");
  const [listingSearch, setListingSearch] = useState("");
  const [productCategory, setProductCategory] = useState("All");
  const [listingForm, setListingForm] = useState({
    title: "", description: "", crop: "", price: "", quantity: "",
    unit: "kg", sellerName: "", location: "", imageBase64: "",
  });
  const [priceStatus, setPriceStatus] = useState<{
    isLive: boolean; source: string; lastFetched: string | null; arrivalDate: string | null; apiConfigured: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/market/prices/status").then(r => r.json()).then(data => setPriceStatus(data as typeof priceStatus)).catch(() => {});
  }, []);

  const { data: prices, isLoading: loadingPrices, refetch: refetchPrices } = useGetMarketPrices({ query: { queryKey: getGetMarketPricesQueryKey() } });
  const { data: listings, isLoading: loadingListings } = useGetMarketListings({ query: { queryKey: getGetMarketListingsQueryKey() } });
  const { data: products, isLoading: loadingProducts } = useGetProductRecommendations({ query: { queryKey: getGetProductRecommendationsQueryKey() } });

  const createListing = useCreateMarketListing();
  const buyListing = useBuyMarketListing();
  const confirmDelivery = useConfirmDelivery();

  const filteredPrices = prices?.filter(p => priceCategory === "All" || (p as { category?: string | null }).category === priceCategory);
  const filteredListings = listings?.filter(l =>
    listingSearch === "" ||
    l.title.toLowerCase().includes(listingSearch.toLowerCase()) ||
    l.crop.toLowerCase().includes(listingSearch.toLowerCase()) ||
    l.location.toLowerCase().includes(listingSearch.toLowerCase())
  );

  const allProductCategories = ["All", ...Array.from(new Set(products?.map(p => p.category) ?? []))];
  const filteredProducts = products?.filter(p => productCategory === "All" || p.category === productCategory);

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
      data: { ...listingForm, price: Number(listingForm.price), quantity: Number(listingForm.quantity), imageBase64: listingForm.imageBase64 || undefined }
    }, {
      onSuccess: () => {
        toast({ title: "⬡ Listed on IPFS + Filecoin", description: "Your produce is now live on the decentralized market." });
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
    buyListing.mutate({ id: buyDialogId, data: { buyerName: buyerNameInput || "Anonymous Buyer" } }, {
      onSuccess: () => {
        toast({ title: "⬡ Funds Locked in Filecoin Escrow", description: "Release after confirming delivery. Agreement stored on IPFS." });
        setBuyDialogId(null);
        setBuyerNameInput("");
        queryClient.invalidateQueries({ queryKey: getGetMarketListingsQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Purchase failed.", variant: "destructive" }),
    });
  };

  const handleConfirmDelivery = (id: number) => {
    confirmDelivery.mutate({ id }, {
      onSuccess: (data) => {
        toast({ title: "✓ Delivery Confirmed — Escrow Released!", description: `Permanent Filecoin receipt minted: ${data.receiptCid ? truncateCid(data.receiptCid) : "stored"}` });
        queryClient.invalidateQueries({ queryKey: getGetMarketListingsQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Confirmation failed.", variant: "destructive" }),
    });
  };

  const selectedListing = listings?.find(l => l.id === buyDialogId);

  return (
    <div className="relative -mx-4 -mt-5 min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ background: "linear-gradient(165deg, #fffbeb 0%, #fef3c7 28%, #fff7ed 60%, #fefce8 100%)" }}>

      {/* Amber blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-amber-300/40 blur-3xl" />
        <div className="absolute top-1/4 -left-16 w-60 h-60 rounded-full bg-orange-200/35 blur-3xl" />
        <div className="absolute top-2/3 right-0 w-56 h-56 rounded-full bg-yellow-300/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-amber-200/25 blur-2xl" />
      </div>

      <div className="relative space-y-5 px-4 pt-5 pb-28">

        {/* ── Hero Header ── */}
        <div className="relative rounded-2xl overflow-hidden p-4 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/30 active:translate-y-0"
          style={{ background: "linear-gradient(135deg, #f97316 0%, #f59e0b 45%, #eab308 100%)", border: "1px solid rgba(255,255,255,0.35)" }}>
          <div className="absolute -top-4 -right-4 w-36 h-36 rounded-full bg-yellow-300/25 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-28 h-16 rounded-full bg-orange-300/20 blur-xl" />
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">Marketplace</h2>
              </div>
              <p className="text-amber-100/80 text-xs mt-0.5 font-medium">Live Mandi Prices · P2P Trade · Filecoin Escrow</p>
            </div>
            <a href="https://lighthouse.storage" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-orange-900 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md hover:bg-white transition-all">
              <span>⬡</span> Protocol Labs
            </a>
          </div>
        </div>

        <Tabs defaultValue="mandi" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-white/50 backdrop-blur-sm border border-white/60">
            <TabsTrigger value="mandi" className="py-1.5 text-xs">📊 {t("market.mandiPrices")}</TabsTrigger>
            <TabsTrigger value="p2p" className="py-1.5 text-xs">🏪 {t("market.p2pTrade")}</TabsTrigger>
            <TabsTrigger value="products" className="py-1.5 text-xs">🌿 {t("market.agriInputs")}</TabsTrigger>
          </TabsList>

          {/* ── MANDI PRICES ── */}
          <TabsContent value="mandi" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 flex-wrap">
                {priceStatus?.isLive ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
                    LIVE · AGMARKNET
                  </span>
                ) : null}
                <p className="text-[10px] text-gray-500">
                  {priceStatus?.isLive ? `Arrival date: ${priceStatus.arrivalDate ?? "today"} · data.gov.in` : "Mandi prices · Hourly refresh"}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-gray-600 hover:bg-white/60"
                onClick={() => { queryClient.invalidateQueries({ queryKey: getGetMarketPricesQueryKey() }); refetchPrices(); }}>
                <RefreshCw className="w-3 h-3" /> Refresh
              </Button>
            </div>

            {/* Category filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {PRICE_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setPriceCategory(cat)}
                  className={`flex-shrink-0 text-[11px] font-medium px-3 py-1 rounded-full border transition-all ${
                    priceCategory === cat
                      ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                      : "bg-white/50 backdrop-blur-sm border-white/60 text-gray-600 hover:border-amber-300 hover:bg-white/70"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Price grid */}
            <div className="grid grid-cols-1 gap-3">
              {loadingPrices
                ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
                : filteredPrices?.map(item => (
                  <MandiPriceCard key={item.id} item={item as typeof item & { category?: string | null }} />
                ))}
            </div>

            {/* Market stats bar */}
            {!loadingPrices && prices && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[
                  { label: "Gainers", value: prices.filter(p => p.change > 0).length, color: "text-emerald-600" },
                  { label: "Decliners", value: prices.filter(p => p.change < 0).length, color: "text-red-600" },
                  { label: "Markets", value: new Set(prices.map(p => p.market)).size, color: "text-amber-600" },
                ].map(s => (
                  <div key={s.label} className="text-center p-2.5 rounded-2xl bg-white/40 backdrop-blur-sm border border-white/60">
                    <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── P2P TRADE ── */}
          <TabsContent value="p2p" className="space-y-4 mt-4">
            {/* Protocol Labs banner */}
            <div className={cn(glassCard, "p-3 border-blue-200/50 bg-blue-50/25")}>
              <p className="text-xs font-semibold text-blue-800 flex items-center gap-1 mb-1">
                ⬡ Powered by Protocol Labs — Decentralized Market
              </p>
              <div className="flex flex-wrap gap-2 text-[10px] text-blue-700">
                <span className="flex items-center gap-1"><CloudUpload className="w-3 h-3" /> Photos on IPFS</span>
                <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Escrow on FVM</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Receipts on Filecoin</span>
                <span className="flex items-center gap-1"><Database className="w-3 h-3" /> Metadata permanent</span>
              </div>
            </div>

            {/* Search + Create */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <Input className="pl-8 h-9 text-sm bg-white/60 border-white/70 backdrop-blur-sm" placeholder="Search crop, seller, location…"
                  value={listingSearch} onChange={e => setListingSearch(e.target.value)} />
              </div>
              <Dialog open={listingOpen} onOpenChange={setListingOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 text-xs gap-1 flex-shrink-0 bg-amber-600 hover:bg-amber-700 text-white">
                    <PlusCircle className="w-3.5 h-3.5" /> Sell
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create IPFS-Backed Listing</DialogTitle>
                    <p className="text-xs text-muted-foreground mt-1">Photo → IPFS · Metadata → Filecoin · Escrow on FVM</p>
                  </DialogHeader>
                  <form onSubmit={handleCreateListing} className="space-y-3.5 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Produce Photo (stored on IPFS)</Label>
                      <div className="border-2 border-dashed border-amber-200 rounded-xl p-4 text-center cursor-pointer hover:border-amber-400 transition-colors"
                        onClick={() => fileInputRef.current?.click()}>
                        {previewImage ? (
                          <img src={previewImage} alt="Preview" className="mx-auto max-h-32 object-cover rounded-lg" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-gray-400">
                            <Image className="w-8 h-8" />
                            <span className="text-xs font-medium">Click to upload photo</span>
                            <span className="text-[10px] text-blue-600">⬡ Stored permanently on IPFS via Lighthouse</span>
                          </div>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Listing Title</Label>
                      <Input required value={listingForm.title} onChange={e => setListingForm({ ...listingForm, title: e.target.value })} placeholder="e.g. Organic Basmati Rice Grade A" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Description</Label>
                      <Input value={listingForm.description} onChange={e => setListingForm({ ...listingForm, description: e.target.value })} placeholder="Quality, grade, certification…" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label className="text-xs">Crop Name</Label><Input required value={listingForm.crop} onChange={e => setListingForm({ ...listingForm, crop: e.target.value })} placeholder="e.g. Wheat" /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Price (₹)</Label><Input type="number" required value={listingForm.price} onChange={e => setListingForm({ ...listingForm, price: e.target.value })} placeholder="2275" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label className="text-xs">Quantity</Label><Input type="number" required value={listingForm.quantity} onChange={e => setListingForm({ ...listingForm, quantity: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Unit</Label><Input required value={listingForm.unit} onChange={e => setListingForm({ ...listingForm, unit: e.target.value })} placeholder="kg, quintal, tonne" /></div>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs">Your Name</Label><Input required value={listingForm.sellerName} onChange={e => setListingForm({ ...listingForm, sellerName: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Location (District, State)</Label><Input required value={listingForm.location} onChange={e => setListingForm({ ...listingForm, location: e.target.value })} placeholder="e.g. Amritsar, Punjab" /></div>
                    <Button type="submit" className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white" disabled={createListing.isPending}>
                      <span>⬡</span>
                      {createListing.isPending ? "Uploading to IPFS + Filecoin…" : "List on Decentralized Market"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Buy escrow dialog */}
            <Dialog open={buyDialogId != null} onOpenChange={(open) => { if (!open) setBuyDialogId(null); }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-600" /> Lock Funds in Filecoin Escrow
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Payment locked in a Filecoin FVM escrow contract. Released to seller only after you confirm delivery.
                  </p>
                </DialogHeader>
                {selectedListing && (
                  <div className="space-y-4 pt-2">
                    <div className="rounded-xl bg-amber-50/60 border border-amber-200/60 p-3.5 space-y-1">
                      <p className="font-semibold text-sm">{selectedListing.title}</p>
                      <p className="text-xs text-muted-foreground">{selectedListing.quantity} {selectedListing.unit} of {selectedListing.crop}</p>
                      <p className="text-muted-foreground text-xs">Seller: {selectedListing.sellerName} · {selectedListing.location}</p>
                      <p className="text-amber-700 font-black text-2xl mt-1">₹{(selectedListing.price * selectedListing.quantity).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Your Name (Buyer)</Label>
                      <Input value={buyerNameInput} onChange={e => setBuyerNameInput(e.target.value)} placeholder="Enter your name" />
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                      <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold mb-0.5">How Filecoin Escrow works:</p>
                        <p>1. Your payment is locked in a smart contract on Filecoin FVM</p>
                        <p>2. The escrow agreement is stored permanently on IPFS</p>
                        <p>3. Funds release to the seller only after you confirm delivery</p>
                      </div>
                    </div>
                    <Button className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleBuy} disabled={buyListing.isPending}>
                      <Lock className="w-4 h-4" />
                      {buyListing.isPending ? "Creating Filecoin Escrow…" : "⬡ Lock in Filecoin Escrow"}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Listings grid */}
            <div className="grid grid-cols-1 gap-4">
              {loadingListings
                ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-80 w-full rounded-2xl" />)
                : !filteredListings || filteredListings.length === 0
                  ? (
                    <div className={cn(glassCard, "text-center py-16")}>
                      <Store className="w-12 h-12 mx-auto mb-3 text-amber-200" />
                      <p className="text-sm font-medium text-gray-500">{listingSearch ? "No listings match your search" : "No listings yet. Be the first to sell!"}</p>
                    </div>
                  )
                  : filteredListings.map(listing => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      onBuy={() => setBuyDialogId(listing.id)}
                      onConfirm={() => handleConfirmDelivery(listing.id)}
                      isBuying={buyListing.isPending}
                      isConfirming={confirmDelivery.isPending}
                    />
                  ))}
            </div>
          </TabsContent>

          {/* ── AGRI INPUTS ── */}
          <TabsContent value="products" className="space-y-4 mt-4">
            <div className={cn(glassCard, "p-3 border-emerald-200/50 bg-emerald-50/25")}>
              <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5" /> AI-recommended inputs based on your soil & crop profile
              </p>
              <p className="text-[10px] text-emerald-700 mt-0.5">
                Products selected based on your latest NPK readings, pH levels, and crop type
              </p>
            </div>

            {/* Category filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {allProductCategories.map(cat => (
                <button key={cat} onClick={() => setProductCategory(cat)}
                  className={`flex-shrink-0 text-[11px] font-medium px-3 py-1 rounded-full border transition-all flex items-center gap-1 ${
                    productCategory === cat
                      ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                      : "bg-white/50 backdrop-blur-sm border-white/60 text-gray-600 hover:border-amber-300 hover:bg-white/70"
                  }`}>
                  {cat !== "All" && PRODUCT_CATEGORY_ICONS[cat]}
                  {cat}
                </button>
              ))}
            </div>

            {!loadingProducts && (
              <p className="text-xs text-gray-500">{filteredProducts?.length ?? 0} products found</p>
            )}

            <div className="grid grid-cols-1 gap-3">
              {loadingProducts
                ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)
                : filteredProducts?.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
