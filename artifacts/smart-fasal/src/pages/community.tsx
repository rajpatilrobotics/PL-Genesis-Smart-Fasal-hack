import { useState, useEffect, useRef } from "react";
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
  AlertTriangle, Bug, Wind, RefreshCw, Users, Circle
} from "lucide-react";
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

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  tip: {
    label: "Tip",
    icon: <Sprout className="w-3 h-3" />,
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  group_buy: {
    label: "Group Buy",
    icon: <ShoppingCart className="w-3 h-3" />,
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-300",
  },
  price_alert: {
    label: "Price Alert",
    icon: <DollarSign className="w-3 h-3" />,
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  question: {
    label: "Question",
    icon: <HelpCircle className="w-3 h-3" />,
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
  weather: {
    label: "Weather",
    icon: <CloudRain className="w-3 h-3" />,
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
  },
};

function CategoryBadge({ category }: { category?: string | null }) {
  const cfg = CATEGORY_CONFIG[category ?? "tip"] ?? CATEGORY_CONFIG.tip;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.color, cfg.bg, cfg.border)}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function timeAgo(date: Date | string): string {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
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

const ONLINE_COUNT = 127;

export default function Community() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const chatBottomRef = useRef<HTMLDivElement>(null);

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

  const filteredPosts = posts?.filter(p =>
    filterCategory === "all" || (p as any).category === filterCategory
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
        toast({ title: "Posted to community ✓" });
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
        toast({ title: "Comment added" });
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

  const handleAskExpert = (expertId: number) => {
    if (!questionText.trim()) return;
    askExpert.mutate({
      data: { question: questionText, askedBy: "Current Farmer", expertId }
    }, {
      onSuccess: () => {
        setQuestionText("");
        setAskExpertId(null);
        queryClient.invalidateQueries({ queryKey: getGetExpertQuestionsQueryKey() });
        toast({ title: "Question sent to expert" });
      }
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Community</h2>
        <p className="text-muted-foreground text-sm flex items-center gap-2">
          Connect, learn, and grow together
          <span className="inline-flex items-center gap-1 text-green-600 font-medium text-xs">
            <Circle className="w-2 h-2 fill-green-500 text-green-500" />
            {ONLINE_COUNT} online
          </span>
        </p>
      </div>

      <Tabs defaultValue="feed" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-4 mb-4 h-10">
          <TabsTrigger value="feed" className="text-xs">📢 Feed</TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs relative">
            🚨 Alerts
            <span className={cn(
              "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 transition-all",
              alertsPulse && "scale-150 opacity-0"
            )} />
          </TabsTrigger>
          <TabsTrigger value="chat" className="text-xs">💬 Chat</TabsTrigger>
          <TabsTrigger value="experts" className="text-xs">🎓 Experts</TabsTrigger>
        </TabsList>

        {/* ─────────── FEED TAB ─────────── */}
        <TabsContent value="feed" className="flex-1 overflow-y-auto pb-4 space-y-3 pr-1">
          {/* Create Post */}
          <Card className="border-primary/20 shadow-sm">
            <CardContent className="p-4 space-y-3">
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
            </CardContent>
          </Card>

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
              const cat = (post as any).category as string ?? "tip";
              const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.tip;
              const isTrending = post.likes >= 100;
              const isGroupBuy = cat === "group_buy";

              return (
                <Card
                  key={post.id}
                  className={cn(
                    "overflow-hidden transition-all",
                    isGroupBuy && "ring-2 ring-amber-300 shadow-amber-100 shadow-md"
                  )}
                >
                  <CardHeader className={cn("p-4 pb-2 flex flex-row items-start gap-3 space-y-0", isGroupBuy && "bg-amber-50/60")}>
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
                          {timeAgo(post.createdAt)}
                        </span>
                        <CategoryBadge category={cat} />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>

                    {(post as any).imageUrl && (
                      <div className="rounded-lg overflow-hidden border border-border">
                        <img
                          src={(post as any).imageUrl}
                          alt="Post image"
                          className="w-full h-48 object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {post.filecoinCid && (
                      <div className="bg-muted/50 p-2 rounded text-[10px] font-mono text-muted-foreground flex items-center gap-2 border border-border">
                        <Lock className="w-3 h-3 flex-shrink-0" />
                        Verified on Filecoin: {post.filecoinCid.substring(0, 20)}...
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="p-3 bg-muted/20 border-t border-border flex flex-col items-stretch gap-2">
                    <div className="flex gap-4 w-full">
                      <button
                        onClick={() => handleLike(post.id)}
                        className={cn(
                          "flex items-center gap-1.5 text-xs transition-colors",
                          likedPosts.has(post.id) ? "text-rose-500" : "text-muted-foreground hover:text-rose-500"
                        )}
                      >
                        <Heart className={cn("w-4 h-4", likedPosts.has(post.id) && "fill-rose-500")} />
                        {post.likes + (likedPosts.has(post.id) ? 0 : 0)}
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
                  </CardFooter>
                </Card>
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
              <Card key={alert.id} className={cn("border", sev.bg)}>
                <CardContent className="p-4 space-y-2">
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
                        {timeAgo(alert.time)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-4 text-center space-y-1">
              <p className="text-sm font-medium">Enable Push Notifications</p>
              <p className="text-xs text-muted-foreground">Get instant alerts for your district when outbreaks are detected</p>
              <Button size="sm" variant="outline" className="mt-2">
                Subscribe to Alerts
              </Button>
            </CardContent>
          </Card>
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
              {ONLINE_COUNT} online
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
            <Card key={expert.id} className="overflow-hidden">
              <CardContent className="p-4">
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
                    <Badge variant="secondary" className="mt-1 text-[10px] px-1.5 h-4">{expert.badge}</Badge>

                    {askExpertId === expert.id ? (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          placeholder="Type your question..."
                          className="min-h-[80px] text-sm"
                          value={questionText}
                          onChange={e => setQuestionText(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={() => handleAskExpert(expert.id)} disabled={askExpert.isPending}>
                            Send Question
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setAskExpertId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant={(expert as any).isOnline ? "default" : "secondary"}
                        className="w-full mt-3"
                        onClick={() => setAskExpertId(expert.id)}
                      >
                        {(expert as any).isOnline ? "Ask Now →" : "Ask a Question"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {expertQuestions && expertQuestions.length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold text-sm mb-3 text-muted-foreground uppercase tracking-wider">My Questions</h3>
              <div className="space-y-3">
                {expertQuestions.map(q => (
                  <Card key={q.id} className="bg-muted/30 border-dashed">
                    <CardContent className="p-3">
                      <div className="flex justify-between mb-2">
                        <Badge variant={q.status === 'ANSWERED' ? 'default' : 'secondary'} className="text-[10px]">
                          {q.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">To: {q.expertName}</span>
                      </div>
                      <p className="text-sm font-medium mb-2">Q: {q.question}</p>
                      {q.answer && (
                        <div className="bg-background p-2 rounded text-sm border border-border">
                          <span className="font-bold text-primary text-xs block mb-1">Answer:</span>
                          {q.answer}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
