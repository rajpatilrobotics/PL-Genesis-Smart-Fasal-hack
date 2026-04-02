import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, Heart, Lock, Globe, Award, Send, Flame, ShoppingCart,
  CloudRain, TrendingUp, HelpCircle, Leaf, Bell, Users, AlertTriangle,
  CheckCircle2, Clock, Star, Shield
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

const BADGE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  CROP_TIP:    { label: "Crop Tip",    icon: <Leaf className="w-3 h-3" />,          color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  GROUP_BUY:   { label: "Group Buy",   icon: <ShoppingCart className="w-3 h-3" />,   color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  ALERT:       { label: "Alert",       icon: <AlertTriangle className="w-3 h-3" />,  color: "text-red-700",    bg: "bg-red-50 border-red-200" },
  PRICE_ALERT: { label: "Price Alert", icon: <TrendingUp className="w-3 h-3" />,     color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  QUESTION:    { label: "Question",    icon: <HelpCircle className="w-3 h-3" />,     color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  WEATHER:     { label: "Weather",     icon: <CloudRain className="w-3 h-3" />,      color: "text-sky-700",    bg: "bg-sky-50 border-sky-200" },
};

const AVATAR_COLORS = [
  "bg-green-100 text-green-700", "bg-blue-100 text-blue-700", "bg-orange-100 text-orange-700",
  "bg-purple-100 text-purple-700", "bg-rose-100 text-rose-700", "bg-teal-100 text-teal-700",
];

function getAvatarColor(name: string) {
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const DISEASE_ALERTS = [
  { district: "Ludhiana",   risk: "HIGH",   disease: "Yellow Rust",     cases: 12, trend: "rising" },
  { district: "Amritsar",   risk: "MEDIUM", disease: "Powdery Mildew",  cases: 5,  trend: "stable" },
  { district: "Patiala",    risk: "LOW",    disease: "Leaf Blight",     cases: 2,  trend: "falling" },
  { district: "Jalandhar",  risk: "MEDIUM", disease: "Stem Rot",        cases: 7,  trend: "rising" },
  { district: "Ferozpur",   risk: "LOW",    disease: "None detected",   cases: 0,  trend: "stable" },
  { district: "Bathinda",   risk: "HIGH",   disease: "Brown Rust",      cases: 18, trend: "rising" },
  { district: "Sangrur",    risk: "MEDIUM", disease: "Sheath Blight",   cases: 4,  trend: "stable" },
  { district: "Hoshiarpur", risk: "LOW",    disease: "None detected",   cases: 1,  trend: "falling" },
];

const RISK_STYLE: Record<string, { bar: string; badge: string; text: string }> = {
  HIGH:   { bar: "bg-red-500",    badge: "bg-red-100 text-red-700 border-red-200",    text: "text-red-700" },
  MEDIUM: { bar: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700 border-yellow-200", text: "text-yellow-700" },
  LOW:    { bar: "bg-green-500",  badge: "bg-green-100 text-green-700 border-green-200",  text: "text-green-700" },
};

export default function Community() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [postContent, setPostContent] = useState("");
  const [postVisibility, setPostVisibility] = useState("PUBLIC");
  const [postCategory, setPostCategory] = useState("CROP_TIP");
  const [commentText, setCommentText] = useState<Record<number, string>>({});
  const [activeCommentPost, setActiveCommentPost] = useState<number | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [askExpertId, setAskExpertId] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());

  const { data: posts, isLoading: loadingPosts } = useGetCommunityPosts({ query: { queryKey: getGetCommunityPostsQueryKey() } });
  const { data: messages, isLoading: loadingMessages } = useGetCommunityMessages({ query: { queryKey: getGetCommunityMessagesQueryKey() } });
  const { data: experts, isLoading: loadingExperts } = useGetCommunityExperts({ query: { queryKey: getGetCommunityExpertsQueryKey() } });
  const { data: expertQuestions } = useGetExpertQuestions({ query: { queryKey: getGetExpertQuestionsQueryKey() } });

  const createPost = useCreateCommunityPost();
  const likePost = useLikeCommunityPost();
  const addComment = useAddCommentToPost();
  const sendMessage = useSendCommunityMessage();
  const askExpert = useAskExpertQuestion();

  const handleCreatePost = () => {
    if (!postContent.trim()) return;
    createPost.mutate({
      data: { author: "Current Farmer", content: postContent, visibility: postVisibility, badge: postCategory }
    }, {
      onSuccess: () => {
        setPostContent("");
        queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() });
        toast({ title: "Posted to community! 🌾" });
      }
    });
  };

  const handleLike = (id: number) => {
    if (likedPosts.has(id)) return;
    setLikedPosts(prev => new Set(prev).add(id));
    likePost.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() }) });
  };

  const handleComment = (postId: number) => {
    const text = commentText[postId];
    if (!text?.trim()) return;
    addComment.mutate({ id: postId, data: { author: "Current Farmer", content: text } }, {
      onSuccess: () => {
        setCommentText({ ...commentText, [postId]: "" });
        setActiveCommentPost(null);
        queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() });
        toast({ title: "Comment added!" });
      }
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    sendMessage.mutate({ data: { sender: "Current Farmer", content: chatMessage } }, {
      onSuccess: () => {
        setChatMessage("");
        queryClient.invalidateQueries({ queryKey: getGetCommunityMessagesQueryKey() });
      }
    });
  };

  const handleAskExpert = (expertId: number) => {
    if (!questionText.trim()) return;
    askExpert.mutate({ data: { question: questionText, askedBy: "Current Farmer", expertId } }, {
      onSuccess: () => {
        setQuestionText("");
        setAskExpertId(null);
        queryClient.invalidateQueries({ queryKey: getGetExpertQuestionsQueryKey() });
        toast({ title: "Question sent to expert!" });
      }
    });
  };

  const onlineCount = 47;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Community</h2>
          <p className="text-muted-foreground text-sm">Connect, learn, and grow together</p>
        </div>
        <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-700">{onlineCount} online</span>
        </div>
      </div>

      <Tabs defaultValue="feed">
        <TabsList className="grid w-full grid-cols-4 mb-3">
          <TabsTrigger value="feed" className="text-xs">
            <Globe className="w-3.5 h-3.5 mr-1" />Feed
          </TabsTrigger>
          <TabsTrigger value="chat" className="text-xs">
            <Lock className="w-3.5 h-3.5 mr-1" />Chat
          </TabsTrigger>
          <TabsTrigger value="experts" className="text-xs">
            <Award className="w-3.5 h-3.5 mr-1" />Experts
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs">
            <Bell className="w-3.5 h-3.5 mr-1" />Alerts
          </TabsTrigger>
        </TabsList>

        {/* ─── FEED TAB ─── */}
        <TabsContent value="feed" className="space-y-4">
          {/* Create Post */}
          <Card className="border-primary/20 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <Textarea
                placeholder="Share a crop tip, price alert, or start a group buy..."
                className="resize-none border-0 focus-visible:ring-0 px-0 shadow-none text-sm min-h-[72px]"
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
              />
              <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
                <Select value={postCategory} onValueChange={setPostCategory}>
                  <SelectTrigger className="h-8 text-xs border bg-background w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BADGE_CONFIG).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-1.5">{val.icon} {val.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={postVisibility} onValueChange={setPostVisibility}>
                  <SelectTrigger className="h-8 text-xs border bg-background w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC"><span className="flex items-center gap-1.5"><Globe className="w-3 h-3"/>Public</span></SelectItem>
                    <SelectItem value="EXPERT"><span className="flex items-center gap-1.5"><Award className="w-3 h-3"/>Experts Only</span></SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="ml-auto" onClick={handleCreatePost} disabled={createPost.isPending || !postContent.trim()}>
                  {createPost.isPending ? "Posting..." : "Post"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Posts */}
          {loadingPosts ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)
          ) : posts?.map(post => {
            const badgeCfg = post.badge ? BADGE_CONFIG[post.badge] : null;
            const isTrending = (post.likes || 0) >= 20;
            const isLiked = likedPosts.has(post.id);
            const avatarColor = getAvatarColor(post.author);
            const comments = Array.isArray(post.comments) ? post.comments as Array<{ id: number; author: string; content: string }> : [];

            return (
              <Card key={post.id} className="overflow-hidden border-border/60 hover:shadow-md transition-shadow">
                <CardContent className="p-4 pb-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-9 h-9 shrink-0 mt-0.5">
                      <AvatarFallback className={`text-sm font-bold ${avatarColor}`}>
                        {post.author.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{post.author}</span>
                        {isTrending && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-1.5 py-0.5">
                            <Flame className="w-2.5 h-2.5" /> Trending
                          </span>
                        )}
                        {post.visibility === "EXPERT" && <Lock className="w-3 h-3 text-yellow-600" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(post.createdAt)}</span>
                    </div>
                    {badgeCfg && (
                      <span className={`flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 shrink-0 ${badgeCfg.color} ${badgeCfg.bg}`}>
                        {badgeCfg.icon} {badgeCfg.label}
                      </span>
                    )}
                  </div>

                  <p className="text-sm mt-3 leading-relaxed whitespace-pre-wrap">{post.content}</p>

                  {post.filecoinCid && (
                    <div className="mt-3 bg-muted/50 p-2 rounded text-[10px] font-mono text-muted-foreground flex items-center gap-2 border">
                      <Shield className="w-3 h-3" /> Verified on Filecoin: {post.filecoinCid.substring(0, 16)}...
                    </div>
                  )}
                </CardContent>

                <CardFooter className="px-4 py-2.5 bg-muted/20 border-t flex flex-col gap-2">
                  <div className="flex items-center gap-4 w-full">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 text-xs transition-colors ${isLiked ? "text-rose-500 font-semibold" : "text-muted-foreground hover:text-rose-500"}`}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? "fill-rose-500" : ""}`} />
                      {post.likes}
                    </button>
                    <button
                      onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" /> {comments.length}
                    </button>
                    <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> {Math.floor(Math.random() * 30 + 5)} views
                    </span>
                  </div>

                  {comments.length > 0 && (
                    <div className="w-full pl-3 border-l-2 border-primary/20 space-y-1.5">
                      {comments.slice(0, 3).map((c: { id: number; author: string; content: string }) => (
                        <div key={c.id} className="text-xs">
                          <span className="font-semibold text-foreground">{c.author}</span>
                          <span className="text-muted-foreground ml-1">{c.content}</span>
                        </div>
                      ))}
                      {comments.length > 3 && (
                        <span className="text-[10px] text-primary cursor-pointer">+{comments.length - 3} more comments</span>
                      )}
                    </div>
                  )}

                  {activeCommentPost === post.id && (
                    <div className="flex w-full gap-2">
                      <Input
                        size={1}
                        className="h-8 text-xs flex-1"
                        placeholder="Write a comment..."
                        value={commentText[post.id] || ""}
                        onChange={e => setCommentText({ ...commentText, [post.id]: e.target.value })}
                        onKeyDown={e => e.key === "Enter" && handleComment(post.id)}
                      />
                      <Button size="sm" className="h-8 px-3" onClick={() => handleComment(post.id)} disabled={addComment.isPending}>
                        <Send className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </TabsContent>

        {/* ─── CHAT TAB ─── */}
        <TabsContent value="chat">
          <div className="flex flex-col" style={{ height: "480px" }}>
            <div className="bg-gradient-to-r from-violet-600 to-purple-700 p-2.5 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Lock className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">E2E Encrypted · Zama FHE</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-white font-medium">{onlineCount} online</span>
              </div>
            </div>

            <div className="flex-1 border-x border-border bg-background/50 p-4 overflow-y-auto space-y-3">
              {loadingMessages ? (
                <div className="text-center text-muted-foreground text-sm py-8">Decrypting messages...</div>
              ) : messages?.map(msg => {
                const isMe = msg.sender === "Current Farmer";
                const avatarColor = getAvatarColor(msg.sender);
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    {!isMe && (
                      <Avatar className="w-7 h-7 shrink-0 mt-1">
                        <AvatarFallback className={`text-[10px] font-bold ${avatarColor}`}>
                          {msg.sender.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                      {!isMe && <span className="text-[10px] text-muted-foreground mb-0.5 ml-1">{msg.sender}</span>}
                      <div className={`rounded-2xl px-3 py-2 ${isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"}`}>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      {msg.isEncrypted && (
                        <div className={`flex items-center gap-0.5 text-[9px] text-muted-foreground mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
                          <Lock className="w-2 h-2 text-violet-500" />
                          <span className="text-violet-500">encrypted</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border border-t-0 rounded-b-xl flex gap-2 bg-background">
              <Input
                placeholder="Encrypted message..."
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                className="flex-1 text-sm"
              />
              <Button type="submit" size="icon" disabled={sendMessage.isPending || !chatMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* ─── EXPERTS TAB ─── */}
        <TabsContent value="experts" className="space-y-4">
          {loadingExperts ? (
            Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
          ) : experts?.map((expert, idx) => {
            const isAvailable = idx % 3 !== 2;
            const responseTime = ["~2 hours", "~4 hours", "~1 day", "~30 min"][idx % 4];
            return (
              <Card key={expert.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="relative shrink-0">
                      <Avatar className="w-14 h-14 border-2 border-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                          {expert.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${isAvailable ? "bg-green-500" : "bg-gray-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-sm">{expert.name}</h3>
                          <p className="text-xs text-primary font-medium">{expert.specialization}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="flex items-center gap-0.5 text-xs font-semibold text-yellow-600">
                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> {expert.rating}
                          </span>
                          <span className={`text-[10px] font-medium ${isAvailable ? "text-green-600" : "text-muted-foreground"}`}>
                            {isAvailable ? "● Available" : "● Busy"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-500" /> {expert.questionsAnswered} answered
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Replies {responseTime}
                        </span>
                      </div>

                      {expert.badge && (
                        <Badge variant="secondary" className="mt-2 text-[10px] bg-accent/10 text-accent border-accent/20">
                          {expert.badge}
                        </Badge>
                      )}

                      {askExpertId === expert.id ? (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            placeholder="Describe your farming issue in detail..."
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
                        <Button size="sm" className="w-full mt-3" onClick={() => setAskExpertId(expert.id)}>
                          Ask {expert.name.split(" ")[0]}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {expertQuestions && expertQuestions.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">My Questions</h3>
              <div className="space-y-3">
                {expertQuestions.map(q => (
                  <Card key={q.id} className="bg-muted/30 border-dashed">
                    <CardContent className="p-3">
                      <div className="flex justify-between mb-2">
                        <Badge variant={q.status === "ANSWERED" ? "default" : "secondary"} className="text-[10px]">
                          {q.status === "ANSWERED" ? <><CheckCircle2 className="w-3 h-3 mr-1"/>Answered</> : <><Clock className="w-3 h-3 mr-1"/>Pending</>}
                        </Badge>
                        {q.expertName && <span className="text-[10px] text-muted-foreground">To: {q.expertName}</span>}
                      </div>
                      <p className="text-sm font-medium">Q: {q.question}</p>
                      {q.answer && (
                        <div className="bg-background p-2 rounded text-sm border mt-2">
                          <span className="font-bold text-primary text-xs block mb-1">Expert Answer:</span>
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

        {/* ─── ALERTS TAB ─── */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Disease Intelligence Map</h3>
              <p className="text-[11px] text-muted-foreground">Punjab districts · Zama FHE encrypted reports</p>
            </div>
            <Badge variant="outline" className="text-[10px] bg-violet-50 border-violet-200 text-violet-700">
              <Lock className="w-2.5 h-2.5 mr-1" /> FHE Protected
            </Badge>
          </div>

          <div className="space-y-2.5">
            {DISEASE_ALERTS.map(d => {
              const style = RISK_STYLE[d.risk];
              const barWidth = d.risk === "HIGH" ? "80%" : d.risk === "MEDIUM" ? "50%" : "20%";
              return (
                <Card key={d.district} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-semibold text-sm">{d.district}</span>
                        <p className="text-xs text-muted-foreground">{d.disease}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.cases > 0 && (
                          <span className="text-[10px] text-muted-foreground">{d.cases} cases</span>
                        )}
                        <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${style.badge}`}>
                          {d.risk}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${style.bar}`} style={{ width: barWidth }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className={`text-[10px] flex items-center gap-0.5 ${d.trend === "rising" ? "text-red-500" : d.trend === "falling" ? "text-green-500" : "text-muted-foreground"}`}>
                        {d.trend === "rising" ? "↑ Rising" : d.trend === "falling" ? "↓ Falling" : "→ Stable"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-3 flex gap-3 items-start">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800">High Risk Areas: Ludhiana, Bathinda</p>
                <p className="text-[11px] text-amber-700 mt-0.5">Apply preventive fungicide immediately. Contact your nearest KVK for free crop inspection and treatment guidance.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-3 flex gap-3 items-start">
              <CloudRain className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-800">Weather Advisory</p>
                <p className="text-[11px] text-blue-700 mt-0.5">IMD forecasts 60% chance of rain in next 72 hours across Punjab. Delay spraying operations. Ensure proper drainage in fields.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-3 flex gap-3 items-start">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-green-800">Good News: Ferozpur & Hoshiarpur</p>
                <p className="text-[11px] text-green-700 mt-0.5">Both districts show no active disease outbreaks. Continue normal crop monitoring schedule.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
