import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, Heart, Lock, Globe, Award, Send, TrendingUp,
  Sprout, ShoppingCart, DollarSign, HelpCircle, CloudRain,
  AlertTriangle, Bug, Wind, RefreshCw, Users, Circle,
  Coins, Loader2, ExternalLink, CheckCircle2
} from "lucide-react";
import { fcl } from "@/lib/flow";
import { useWallet } from "@/lib/wallet-context";
import {
  useGetCommunityPosts, getGetCommunityPostsQueryKey,
  useCreateCommunityPost,
  useLikeCommunityPost,
  useAddCommentToPost,
  useGetCommunityMessages, getGetCommunityMessagesQueryKey,
  useSendCommunityMessage,
  useGetCommunityExperts, getGetCommunityExpertsQueryKey,
  useGetExpertQuestions, getGetExpertQuestionsQueryKey,
  useAskExpertQuestion
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type Category = "tip" | "group_buy" | "price_alert" | "question" | "weather";

const CATEGORY_CONFIG: Record<string, { labelKey: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  tip: {
    labelKey: "community.catTip",
    icon: <Sprout className="w-3 h-3" />,
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  group_buy: {
    labelKey: "community.catGroupBuy",
    icon: <ShoppingCart className="w-3 h-3" />,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-300",
  },
  price_alert: {
    labelKey: "community.catPriceAlert",
    icon: <DollarSign className="w-3 h-3" />,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  question: {
    labelKey: "community.catQuestion",
    icon: <HelpCircle className="w-3 h-3" />,
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  weather: {
    labelKey: "community.catWeather",
    icon: <CloudRain className="w-3 h-3" />,
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
  },
};

function CategoryBadge({ category }: { category?: string | null }) {
  const { t } = useTranslation();
  const cfg = CATEGORY_CONFIG[category ?? "tip"] ?? CATEGORY_CONFIG.tip;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.color, cfg.bg, cfg.border)}>
      {cfg.icon}
      {t(cfg.labelKey)}
    </span>
  );
}

function timeAgo(date: Date | string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return t("community.justNow");
  if (diff < 3600) return `${Math.floor(diff / 60)}${t("community.minutesAgo")}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${t("community.hoursAgo")}`;
  return `${Math.floor(diff / 86400)}${t("community.daysAgo")}`;
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const MOCK_ALERTS = [
  {
    id: 1,
    type: "disease",
    title: "Late Blight Outbreak — Nashik District",
    detail: "Phytophthora infestans detected across 12 farms. High humidity (92%) accelerating spread. Spray Metalaxyl + Mancozeb immediately.",
    severity: "high",
    regions: ["Nashik", "Niphad", "Sinnar"],
    time: new Date(Date.now() - 2 * 3600000),
  },
  {
    id: 2,
    type: "weather",
    title: "Cyclone Advisory — Odisha Coast",
    detail: "Depression intensifying. Expected landfall in 36 hours. Coastal farmers advised to harvest standing crops immediately.",
    severity: "critical",
    regions: ["Puri", "Bhubaneswar", "Cuttack"],
    time: new Date(Date.now() - 45 * 60000),
  },
  {
    id: 3,
    type: "disease",
    title: "Yellow Rust Alert — Punjab Wheat Belt",
    detail: "Stripe rust (Puccinia striiformis) spreading rapidly. Cool temperatures favoring fungal growth. Apply Propiconazole 25 EC.",
    severity: "medium",
    regions: ["Ludhiana", "Patiala", "Amritsar"],
    time: new Date(Date.now() - 5 * 3600000),
  },
  {
    id: 4,
    type: "weather",
    title: "Frost Warning — Himachal Pradesh",
    detail: "Temperature dropping to -2°C tonight. Apple and vegetable growers must cover crops with frost cloth or straw mulch.",
    severity: "medium",
    regions: ["Shimla", "Kullu", "Manali"],
    time: new Date(Date.now() - 30 * 60000),
  },
  {
    id: 5,
    type: "disease",
    title: "Rice Brown Planthopper — Kerala",
    detail: "BPH infestation reported in Kuttanad region. Avoid excessive nitrogen fertilization. Use recommended insecticides only.",
    severity: "high",
    regions: ["Kuttanad", "Alappuzha", "Kottayam"],
    time: new Date(Date.now() - 8 * 3600000),
  },
];

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "text-red-700", bg: "bg-red-50 border-red-300", label: "Critical" },
  high: { color: "text-orange-700", bg: "bg-orange-50 border-orange-300", label: "High" },
  medium: { color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-300", label: "Medium" },
};

const BASE_ONLINE_COUNT = 127;

export default function Community() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const { walletAddress, addExpertPayment } = useWallet();

  const [postContent, setPostContent] = useState("");
  const [postVisibility, setPostVisibility] = useState("PUBLIC");
  const [postCategory, setPostCategory] = useState<Category>("tip");
  const [commentText, setCommentText] = useState<{ [key: number]: string }>({});
  const [activeCommentPost, setActiveCommentPost] = useState<number | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [chatMessage, setChatMessage] = useState("");
  const [askExpertId, setAskExpertId] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [alertsLastRefresh, setAlertsLastRefresh] = useState(new Date());
  const [alertsPulse, setAlertsPulse] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [payingExpertId, setPayingExpertId] = useState<number | null>(null);
  const [paidTxIds, setPaidTxIds] = useState<Record<number, string>>({});
  const [onlineCount, setOnlineCount] = useState(BASE_ONLINE_COUNT);

  const { data: posts, isLoading: loadingPosts } = useGetCommunityPosts({ query: { queryKey: getGetCommunityPostsQueryKey() } });
  const { data: messages, isLoading: loadingMessages } = useGetCommunityMessages({ query: { queryKey: getGetCommunityMessagesQueryKey() } });
  const { data: experts, isLoading: loadingExperts } = useGetCommunityExperts({ query: { queryKey: getGetCommunityExpertsQueryKey() } });
  const { data: expertQuestions, isLoading: loadingQuestions } = useGetExpertQuestions({ query: { queryKey: getGetExpertQuestionsQueryKey() } });

  const createPost = useCreateCommunityPost();
  const likePost = useLikeCommunityPost();
  const addComment = useAddCommentToPost();
  const sendMessage = useSendCommunityMessage();
  const askExpert = useAskExpertQuestion();

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAlertsPulse(true);
      setAlertsLastRefresh(new Date());
      setTimeout(() => setAlertsPulse(false), 1000);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount(BASE_ONLINE_COUNT + Math.floor(Math.random() * 31) - 15);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredPosts = posts?.filter(p =>
    filterCategory === "all" || p.category === filterCategory
  );

  const handleCreatePost = () => {
    if (!postContent.trim()) return;
    createPost.mutate({
      data: {
        author: "Current Farmer",
        content: postContent,
        visibility: postVisibility,
        category: postCategory,
      } as any
    }, {
      onSuccess: () => {
        setPostContent("");
        queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() });
        toast({ title: t("community.postedToCommunity") + " ✓" });
      }
    });
  };

  const handleLike = (id: number) => {
    if (likedPosts.has(id)) return;
    setLikedPosts(prev => new Set([...prev, id]));
    likePost.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() })
    });
  };

  const handleComment = (postId: number) => {
    const text = commentText[postId];
    if (!text?.trim()) return;
    addComment.mutate({
      id: postId,
      data: { author: "Current Farmer", content: text }
    }, {
      onSuccess: () => {
        setCommentText({ ...commentText, [postId]: "" });
        setActiveCommentPost(null);
        queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() });
        toast({ title: t("community.commentAdded") });
      }
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    sendMessage.mutate({
      data: { sender: "Current Farmer", content: chatMessage }
    }, {
      onSuccess: () => {
        setChatMessage("");
        queryClient.invalidateQueries({ queryKey: getGetCommunityMessagesQueryKey() });
      }
    });
  };

  const handleAskExpert = async (expertId: number, expertName: string) => {
    if (!questionText.trim()) return;
    setPayingExpertId(expertId);
    const consultationId = `CONSULT-${expertId}-${Date.now()}`;
    const expertAddr = "0x01cf0e2f2f715450";
    let flowTxId = `demo-pay-${Math.random().toString(36).substring(2, 14)}`;

    try {
      if (walletAddress) {
        const txId = await fcl.mutate({
          cadence: `
            import FungibleToken from 0x9a0766d93b6608b7
            import FlowToken from 0x7e60df042a9c0868

            transaction(
              amount: UFix64, expertAddress: Address,
              consultationId: String, expertName: String, farmerAddress: Address
            ) {
              let sentVault: @{FungibleToken.Vault}

              prepare(signer: auth(BorrowValue) &Account) {
                let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
                  from: /storage/flowTokenVault
                ) ?? panic("No Flow token vault found")
                self.sentVault <- vaultRef.withdraw(amount: amount)
              }

              execute {
                let recipient = getAccount(expertAddress)
                let receiverRef = recipient.capabilities.borrow<&{FungibleToken.Receiver}>(
                  /public/flowTokenReceiver
                ) ?? panic("Expert cannot receive FLOW")
                receiverRef.deposit(from: <-self.sentVault)
                log("SmartFasal::ExpertConsultation::Paid"
                  .concat("|id=").concat(consultationId)
                  .concat("|expert=").concat(expertName)
                  .concat("|amount=0.001FLOW")
                  .concat("|farmer=").concat(farmerAddress.toString()))
              }
            }
          `,
          args: (arg: any, t: any) => [
            arg("0.00100000", t.UFix64),
            arg(expertAddr, t.Address),
            arg(consultationId, t.String),
            arg(expertName, t.String),
            arg(walletAddress, t.Address),
          ],
          proposer: fcl.authz,
          payer: fcl.authz,
          authorizations: [fcl.authz],
          limit: 999,
        });
        await fcl.tx(txId).onceSealed();
        flowTxId = txId;
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("Declined") || msg.includes("Halted")) {
        setPayingExpertId(null);
        toast({ title: "Payment cancelled", variant: "destructive" });
        return;
      }
    }

    setPaidTxIds(prev => ({ ...prev, [expertId]: flowTxId }));
    addExpertPayment({
      id: consultationId,
      expertName,
      amount: 0.001,
      flowTxId,
      question: questionText,
      paidAt: new Date().toISOString(),
    });

    askExpert.mutate({
      data: { question: questionText, askedBy: "Current Farmer", expertId }
    }, {
      onSuccess: () => {
        setQuestionText("");
        setAskExpertId(null);
        setPayingExpertId(null);
        queryClient.invalidateQueries({ queryKey: getGetExpertQuestionsQueryKey() });
        const isLive = !flowTxId.startsWith("demo");
        toast({
          title: isLive ? "Consultation paid & question sent on Flow! ✅" : "Consultation paid & question sent! ✅",
          description: isLive ? `TX: ${flowTxId.substring(0, 14)}…` : `0.001 FLOW · ${consultationId}`,
        });
      }
    });
  };

  const glassCard = "glass-glow-teal rounded-2xl border border-white/50 bg-white/35 backdrop-blur-2xl hover:bg-white/45";

  return (
    <div className="relative -mx-4 -mt-5 min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ background: "linear-gradient(165deg, #f0fdfa 0%, #ccfbf1 25%, #cffafe 55%, #e0f2fe 100%)" }}>

      {/* Teal/sky blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-teal-300/30 blur-3xl" />
        <div className="absolute top-1/4 -left-16 w-60 h-60 rounded-full bg-cyan-200/25 blur-3xl" />
        <div className="absolute top-2/3 right-0 w-56 h-56 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 rounded-full bg-emerald-100/20 blur-2xl" />
      </div>

      <div className="relative px-4 pt-5 pb-28 flex flex-col" style={{ minHeight: "100vh" }}>

        {/* Hero Header */}
        <div className="relative rounded-2xl overflow-hidden p-4 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-teal-500/30 active:translate-y-0 mb-4"
          style={{ background: "linear-gradient(135deg, #0f766e 0%, #0d9488 45%, #06b6d4 100%)", border: "1px solid rgba(255,255,255,0.35)" }}>
          <div className="absolute -top-4 -right-4 w-36 h-36 rounded-full bg-teal-300/20 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-28 h-16 rounded-full bg-cyan-300/20 blur-xl" />
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">{t("community.title")}</h2>
              </div>
              <p className="text-teal-100/80 text-xs mt-0.5 font-medium">{t("community.connectLearnGrow")}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-green-900 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
              <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
              {onlineCount} {t("community.onlineFarmers")}
            </div>
          </div>
        </div>

      <Tabs defaultValue="feed" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-4 mb-4 h-auto p-1 bg-white/50 backdrop-blur-sm border border-white/60">
          <TabsTrigger value="feed" className="text-xs py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-teal-200/60">📢 {t("community.feed")}</TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs py-1.5 relative data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-teal-200/60">
            🚨 {t("community.alerts")}
            <span className={cn(
              "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 transition-all",
              alertsPulse && "scale-150 opacity-0"
            )} />
          </TabsTrigger>
          <TabsTrigger value="chat" className="text-xs py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-teal-200/60">💬 {t("community.chat")}</TabsTrigger>
          <TabsTrigger value="experts" className="text-xs py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-teal-200/60">🎓 {t("community.experts")}</TabsTrigger>
        </TabsList>

        {/* ─────────── FEED TAB ─────────── */}
        <TabsContent value="feed" className="flex-1 overflow-y-auto pb-4 space-y-3 pr-1">
          {/* Create Post */}
          <div className={`${glassCard} p-4 space-y-3`}>
              <Textarea
                placeholder="Share a tip, ask a question, alert the community..."
                className="resize-none border-0 focus-visible:ring-0 px-0 shadow-none min-h-[72px]"
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
              />
              <div className="flex flex-wrap justify-between items-center pt-2 border-t gap-2">
                <div className="flex gap-2 items-center flex-wrap">
                  <Select value={postCategory} onValueChange={v => setPostCategory(v as Category)}>
                    <SelectTrigger className="h-7 text-xs border bg-muted/40 w-[120px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-1.5">{cfg.icon} {cfg.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={postVisibility} onValueChange={setPostVisibility}>
                    <SelectTrigger className="h-7 text-xs border bg-muted/40 w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC"><span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> Public</span></SelectItem>
                      <SelectItem value="EXPERT"><span className="flex items-center gap-1.5"><Award className="w-3 h-3" /> Experts Only</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={handleCreatePost} disabled={createPost.isPending || !postContent.trim()}>
                  Post
                </Button>
              </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setFilterCategory("all")}
              className={cn(
                "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all",
                filterCategory === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground border-border hover:border-primary/50"
              )}
            >
              All Posts
            </button>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setFilterCategory(filterCategory === key ? "all" : key)}
                className={cn(
                  "flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all",
                  filterCategory === key
                    ? `${cfg.bg} ${cfg.color} ${cfg.border} border`
                    : "bg-muted/40 text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>

          {/* Posts */}
          <div className="space-y-3">
            {loadingPosts ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)
            ) : filteredPosts?.map(post => {
              const cat = post.category ?? "tip";
              const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.tip;
              const isTrending = post.likes >= 100;
              const isGroupBuy = cat === "group_buy";

              return (
                <div
                  key={post.id}
                  className={cn(
                    glassCard, "overflow-hidden transition-all",
                    isGroupBuy && "ring-2 ring-amber-300 shadow-amber-100 shadow-md"
                  )}
                >
                  <div className={cn("p-4 pb-2 flex flex-row items-start gap-3", isGroupBuy && "bg-amber-50/30")}>
                    <Avatar className="w-9 h-9 border-2 border-primary/20 flex-shrink-0">
                      <AvatarFallback className={cn("font-bold text-sm", isGroupBuy ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary")}>
                        {post.author.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm truncate">{post.author}</span>
                        {post.badge && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-accent/20 text-accent-foreground border-0 flex-shrink-0">
                            {post.badge}
                          </Badge>
                        )}
                        {isTrending && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0 rounded-full flex-shrink-0">
                            <TrendingUp className="w-2.5 h-2.5" /> Trending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {post.visibility === 'EXPERT' && <Lock className="w-2.5 h-2.5 inline mr-0.5 text-yellow-600" />}
                          {timeAgo(post.createdAt, t)}
                        </span>
                        <CategoryBadge category={cat} />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-2 space-y-3">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>

                    {post.imageUrl && (
                      <div className="rounded-lg overflow-hidden border border-border">
                        <img
                          src={post.imageUrl}
                          alt="Post image"
                          className="w-full h-48 object-cover"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    )}

                    {post.filecoinCid && (
                      <div className="bg-muted/50 p-2 rounded text-[10px] font-mono text-muted-foreground flex items-center gap-2 border border-border">
                        <Lock className="w-3 h-3 flex-shrink-0" />
                        Verified on Filecoin: {post.filecoinCid.substring(0, 20)}...
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-white/20 border-t border-white/30 flex flex-col items-stretch gap-2">
                    <div className="flex gap-4 w-full">
                      <button
                        onClick={() => handleLike(post.id)}
                        className={cn(
                          "flex items-center gap-1.5 text-xs transition-colors",
                          likedPosts.has(post.id) ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"
                        )}
                      >
                        <Heart className={cn("w-4 h-4 transition-transform", likedPosts.has(post.id) && "fill-rose-500 scale-125")} />
                        {post.likes + (likedPosts.has(post.id) ? 1 : 0)}
                      </button>
                      <button
                        onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" /> {post.comments.length}
                      </button>
                    </div>

                    {post.comments.length > 0 && (
                      <div className="space-y-2 w-full pl-3 border-l-2 border-primary/20">
                        {post.comments.map(c => (
                          <div key={c.id} className="text-xs">
                            <span className="font-bold mr-1">{c.author}:</span>
                            <span className="text-muted-foreground">{c.content}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeCommentPost === post.id && (
                      <div className="flex w-full gap-2 mt-1">
                        <Input
                          size={1}
                          className="h-8 text-xs flex-1"
                          placeholder="Write a comment..."
                          value={commentText[post.id] || ""}
                          onChange={e => setCommentText({ ...commentText, [post.id]: e.target.value })}
                          onKeyDown={e => e.key === "Enter" && handleComment(post.id)}
                        />
                        <Button size="sm" className="h-8" onClick={() => handleComment(post.id)} disabled={addComment.isPending}>
                          Send
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ─────────── ALERTS TAB ─────────── */}
        <TabsContent value="alerts" className="flex-1 overflow-y-auto pb-4 space-y-3 pr-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Disease & Weather Alerts</h3>
              <p className="text-[11px] text-muted-foreground">Auto-refreshes every 30 seconds</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className={cn("w-3 h-3 transition-all", alertsPulse && "animate-spin text-primary")} />
              {formatTime(alertsLastRefresh)}
            </div>
          </div>

          {/* Live Pulse Indicator */}
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-xs font-semibold text-red-700">LIVE — Monitoring 847 farms across India</span>
          </div>

          {MOCK_ALERTS.map(alert => {
            const sev = SEVERITY_CONFIG[alert.severity];
            return (
              <div key={alert.id} className={cn(glassCard, "border-l-4")} style={{ borderLeftColor: alert.severity === "CRITICAL" ? "#ef4444" : alert.severity === "HIGH" ? "#f97316" : "#eab308" }}>
                <div className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5 p-1.5 rounded-full", alert.type === "disease" ? "bg-orange-100" : "bg-blue-100")}>
                      {alert.type === "disease"
                        ? <Bug className="w-4 h-4 text-orange-600" />
                        : <Wind className="w-4 h-4 text-blue-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-sm">{alert.title}</span>
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", sev.color, sev.bg)}>
                          {sev.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{alert.detail}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {alert.regions.map(r => (
                          <span key={r} className="text-[10px] bg-white/60 border border-border px-2 py-0.5 rounded-full">{r}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {timeAgo(alert.time, t)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className={`${glassCard} border-dashed`}>
            <div className="p-4 text-center space-y-1">
              <p className="text-sm font-medium">Enable Push Notifications</p>
              <p className="text-xs text-muted-foreground">Get instant alerts for your district when outbreaks are detected</p>
              <Button size="sm" variant="outline" className="mt-2">
                Subscribe to Alerts
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ─────────── CHAT TAB ─────────── */}
        <TabsContent value="chat" className="flex-1 flex flex-col min-h-[400px]">
          <div className="bg-primary/10 border border-primary/20 p-2 rounded-t-lg flex items-center justify-between text-xs font-semibold text-primary">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              End-to-End Encrypted via Zama FHE
            </span>
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <Users className="w-3 h-3" />
              {onlineCount} online
            </span>
          </div>

          <div className="flex-1 border-x border-border bg-background p-3 overflow-y-auto space-y-3">
            {loadingMessages ? (
              <div className="space-y-3">
                {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-3/4" style={{ marginLeft: i % 2 === 0 ? 0 : "auto" }} />)}
              </div>
            ) : messages?.map((msg, i) => {
              const isMe = msg.sender === "Current Farmer";
              const showSender = i === 0 || messages[i - 1]?.sender !== msg.sender;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {showSender && !isMe && (
                    <span className="text-[10px] text-muted-foreground ml-1 mb-0.5">{msg.sender}</span>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                  <div className={cn("flex items-center gap-1 mt-0.5", isMe ? "flex-row-reverse" : "flex-row")}>
                    <span className="text-[9px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                    {msg.isEncrypted && (
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <Lock className="w-2 h-2" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-2.5 border border-t-0 rounded-b-lg flex gap-2 bg-background">
            <Input
              placeholder="Secure message..."
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              className="flex-1 h-9"
            />
            <Button type="submit" size="icon" className="h-9 w-9" disabled={sendMessage.isPending || !chatMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </TabsContent>

        {/* ─────────── EXPERTS TAB ─────────── */}
        <TabsContent value="experts" className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loadingExperts ? (
            Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)
          ) : experts?.map(expert => (
            <div key={expert.id} className={`${glassCard} overflow-hidden`}>
              <div className="p-4">
                <div className="flex gap-3">
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-14 h-14 border-2 border-accent">
                      <AvatarFallback className="bg-accent/10 text-accent font-bold text-xl">
                        {expert.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className={cn(
                      "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background",
                      (expert as any).isOnline ? "bg-green-500" : "bg-gray-300"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm truncate">{expert.name}</h3>
                        <p className="text-xs text-primary font-medium">{expert.specialization}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-700 text-[10px]">
                          ★ {expert.rating}
                        </Badge>
                        <span className={cn(
                          "text-[10px] font-semibold",
                          (expert as any).isOnline ? "text-green-600" : "text-muted-foreground"
                        )}>
                          {(expert as any).isOnline ? "● Online now" : "○ Away"}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {expert.experience} • {expert.questionsAnswered} questions answered
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{expert.badge}</Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 h-4 border-green-300 text-green-700 bg-green-50">
                        <Coins className="w-2.5 h-2.5 mr-0.5" />0.001 FLOW
                      </Badge>
                    </div>

                    {paidTxIds[expert.id] && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-green-600 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                        <span>Paid via Flow</span>
                        {!paidTxIds[expert.id].startsWith("demo") && (
                          <a href={`https://testnet.flowscan.io/tx/${paidTxIds[expert.id]}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 font-semibold hover:underline">
                            <ExternalLink className="w-2.5 h-2.5" /> Flowscan
                          </a>
                        )}
                      </div>
                    )}

                    {askExpertId === expert.id ? (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          placeholder="Type your question..."
                          className="min-h-[80px] text-sm"
                          value={questionText}
                          onChange={e => setQuestionText(e.target.value)}
                        />
                        <div className="bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 text-[10px] text-green-700 flex items-center gap-1.5">
                          <Coins className="w-3 h-3 flex-shrink-0" />
                          Sending 0.001 FLOW to expert on Flow Testnet before submitting question
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleAskExpert(expert.id, expert.name)}
                            disabled={askExpert.isPending || payingExpertId === expert.id}
                          >
                            {payingExpertId === expert.id
                              ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Paying on Flow...</>
                              : <><Coins className="w-3 h-3 mr-1.5" />Pay 0.001 FLOW & Ask</>
                            }
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setAskExpertId(null)} disabled={payingExpertId === expert.id}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant={(expert as any).isOnline ? "default" : "secondary"}
                        className="w-full mt-3"
                        onClick={() => setAskExpertId(expert.id)}
                      >
                        {(expert as any).isOnline ? `${t("community.askNow")} →` : t("community.askAQuestion")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {expertQuestions && expertQuestions.length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold text-sm mb-3 text-muted-foreground uppercase tracking-wider">{t("community.myQuestions")}</h3>
              <div className="space-y-3">
                {expertQuestions.map(q => (
                  <div key={q.id} className={`${glassCard} border-dashed`}>
                    <div className="p-3">
                      <div className="flex justify-between mb-2">
                        <Badge variant={q.status === 'ANSWERED' ? 'default' : 'secondary'} className="text-[10px]">
                          {q.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{t("community.toExpert")}: {q.expertName}</span>
                      </div>
                      <p className="text-sm font-medium mb-2">Q: {q.question}</p>
                      {q.answer && (
                        <div className="bg-white/50 p-2 rounded text-sm border border-white/40">
                          <span className="font-bold text-primary text-xs block mb-1">{t("community.answer")}:</span>
                          {q.answer}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
