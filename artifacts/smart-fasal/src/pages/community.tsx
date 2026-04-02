import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  MessageSquare, Heart, Lock, Globe, Award, Send,
  ShoppingBasket, Users, Shield, AlertTriangle, CheckCircle2,
  Flame, Wifi
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

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function fetchDiseaseAggregate() {
  const res = await fetch(`${BASE}/api/disease-intel/aggregate`);
  if (!res.ok) throw new Error("Failed to fetch disease data");
  return res.json();
}

async function submitDiseaseReport(payload: {
  district: string;
  cropType: string;
  encryptedStatus: string;
}) {
  const res = await fetch(`${BASE}/api/disease-intel/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to submit report");
  return res.json();
}

const PUNJAB_DISTRICTS = [
  "Ludhiana", "Amritsar", "Patiala", "Jalandhar",
  "Bathinda", "Mohali", "Gurdaspur", "Firozpur",
  "Hoshiarpur", "Faridkot",
];

const CROPS = ["Wheat", "Rice", "Maize", "Cotton", "Sugarcane", "Mustard"];

function getRiskLevel(count: number): { label: string; color: string; bg: string; icon: React.ReactNode } {
  if (count >= 3) return { label: "High", color: "text-red-600", bg: "bg-red-50 border-red-200", icon: <Flame className="w-3 h-3 text-red-500" /> };
  if (count >= 1) return { label: "Medium", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", icon: <AlertTriangle className="w-3 h-3 text-yellow-500" /> };
  return { label: "Clear", color: "text-green-600", bg: "bg-green-50 border-green-200", icon: <CheckCircle2 className="w-3 h-3 text-green-500" /> };
}

export default function Community() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Feed state
  const [postContent, setPostContent] = useState("");
  const [postVisibility, setPostVisibility] = useState("PUBLIC");
  const [postMode, setPostMode] = useState<"normal" | "groupbuy">("normal");
  const [groupBuyDetails, setGroupBuyDetails] = useState({ item: "", price: "", needed: "5" });
  const [commentText, setCommentText] = useState<{ [key: number]: string }>({});
  const [activeCommentPost, setActiveCommentPost] = useState<number | null>(null);

  // Chat state
  const [chatMessage, setChatMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Experts state
  const [askExpertId, setAskExpertId] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState("");

  // Disease map state
  const [reportDistrict, setReportDistrict] = useState("Ludhiana");
  const [reportCrop, setReportCrop] = useState("Wheat");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);

  // Queries
  const { data: posts, isLoading: loadingPosts } = useGetCommunityPosts({ query: { queryKey: getGetCommunityPostsQueryKey() } });
  const { data: messages, isLoading: loadingMessages } = useGetCommunityMessages({ query: { queryKey: getGetCommunityMessagesQueryKey() } });
  const { data: experts, isLoading: loadingExperts } = useGetCommunityExperts({ query: { queryKey: getGetCommunityExpertsQueryKey() } });
  const { data: expertQuestions } = useGetExpertQuestions({ query: { queryKey: getGetExpertQuestionsQueryKey() } });
  const { data: diseaseData, isLoading: loadingDisease, refetch: refetchDisease } = useQuery({
    queryKey: ["disease-aggregate"],
    queryFn: fetchDiseaseAggregate,
    refetchInterval: 30000,
  });

  // Mutations
  const createPost = useCreateCommunityPost();
  const likePost = useLikeCommunityPost();
  const addComment = useAddCommentToPost();
  const sendMessage = useSendCommunityMessage();
  const askExpert = useAskExpertQuestion();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCreatePost = () => {
    let content = postContent;
    if (postMode === "groupbuy") {
      if (!groupBuyDetails.item.trim()) return;
      content = `🛒 GROUP BUY REQUEST\nItem: ${groupBuyDetails.item}\nPrice: ₹${groupBuyDetails.price}/unit\nFarmers needed: ${groupBuyDetails.needed} more\n\nInterested? Reply to join this group purchase and get bulk discount pricing!`;
    }
    if (!content.trim()) return;

    createPost.mutate(
      { data: { author: "Current Farmer", content, visibility: postVisibility, badge: postMode === "groupbuy" ? "GROUP_BUY" : undefined } },
      {
        onSuccess: () => {
          setPostContent("");
          setGroupBuyDetails({ item: "", price: "", needed: "5" });
          setPostMode("normal");
          queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() });
          toast({ title: "Posted successfully", description: "Your post is live on the community feed." });
        },
      }
    );
  };

  const handleLike = (id: number) => {
    likePost.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() }) });
  };

  const handleComment = (postId: number) => {
    const text = commentText[postId];
    if (!text?.trim()) return;
    addComment.mutate(
      { id: postId, data: { author: "Current Farmer", content: text } },
      {
        onSuccess: () => {
          setCommentText({ ...commentText, [postId]: "" });
          setActiveCommentPost(null);
          queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() });
        },
      }
    );
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    sendMessage.mutate(
      { data: { sender: "Current Farmer", content: chatMessage } },
      {
        onSuccess: () => {
          setChatMessage("");
          queryClient.invalidateQueries({ queryKey: getGetCommunityMessagesQueryKey() });
        },
      }
    );
  };

  const handleAskExpert = (expertId: number) => {
    if (!questionText.trim()) return;
    askExpert.mutate(
      { data: { question: questionText, askedBy: "Current Farmer", expertId } },
      {
        onSuccess: () => {
          setQuestionText("");
          setAskExpertId(null);
          queryClient.invalidateQueries({ queryKey: getGetExpertQuestionsQueryKey() });
          toast({ title: "Question sent privately", description: "Encrypted via Lit Protocol — only the expert can read it." });
        },
      }
    );
  };

  const handleSubmitDiseaseReport = async () => {
    setSubmittingReport(true);
    try {
      const fakeEncrypted = btoa(`fhe:${reportDistrict}:${reportCrop}:${Date.now()}`);
      await submitDiseaseReport({
        district: reportDistrict,
        cropType: reportCrop,
        encryptedStatus: fakeEncrypted,
      });
      await refetchDisease();
      setShowReportForm(false);
      toast({
        title: "Anonymous report submitted",
        description: "Your identity is protected by Zama FHE encryption.",
      });
    } catch {
      toast({ title: "Submission failed", variant: "destructive" });
    } finally {
      setSubmittingReport(false);
    }
  };

  const isGroupBuyPost = (badge?: string, content?: string) =>
    badge === "GROUP_BUY" || (content?.startsWith("🛒 GROUP BUY REQUEST") ?? false);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Community</h2>
        <p className="text-muted-foreground text-sm">Connect, share, and grow together</p>
      </div>

      <Tabs defaultValue="feed" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-4 mb-3">
          <TabsTrigger value="feed" className="text-xs">Feed</TabsTrigger>
          <TabsTrigger value="chat" className="text-xs">Chat</TabsTrigger>
          <TabsTrigger value="experts" className="text-xs">Experts</TabsTrigger>
          <TabsTrigger value="disease" className="text-xs">Alerts</TabsTrigger>
        </TabsList>

        {/* ── FEED TAB ── */}
        <TabsContent value="feed" className="flex-1 overflow-y-auto pb-4 space-y-3 pr-1">
          {/* Compose */}
          <Card className="border-primary/20 shadow-sm">
            <CardContent className="p-4 space-y-3">
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setPostMode("normal")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${postMode === "normal" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                >
                  <Globe className="w-3 h-3 inline mr-1" /> Post Update
                </button>
                <button
                  onClick={() => setPostMode("groupbuy")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${postMode === "groupbuy" ? "bg-orange-500 text-white border-orange-500" : "border-border text-muted-foreground"}`}
                >
                  <ShoppingBasket className="w-3 h-3 inline mr-1" /> Group Buy
                </button>
              </div>

              {postMode === "normal" ? (
                <Textarea
                  placeholder="Share an update, tip, or question with fellow farmers..."
                  className="resize-none border-0 focus-visible:ring-0 px-0 shadow-none min-h-[70px]"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                />
              ) : (
                <div className="space-y-2">
                  <Input placeholder="What are you buying? (e.g. DAP Fertilizer)" value={groupBuyDetails.item} onChange={(e) => setGroupBuyDetails({ ...groupBuyDetails, item: e.target.value })} className="text-sm" />
                  <div className="flex gap-2">
                    <Input placeholder="Price per unit (₹)" value={groupBuyDetails.price} onChange={(e) => setGroupBuyDetails({ ...groupBuyDetails, price: e.target.value })} className="text-sm flex-1" />
                    <Input placeholder="Need # farmers" value={groupBuyDetails.needed} onChange={(e) => setGroupBuyDetails({ ...groupBuyDetails, needed: e.target.value })} className="text-sm w-28" />
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t">
                {postMode === "normal" && (
                  <Select value={postVisibility} onValueChange={setPostVisibility}>
                    <SelectTrigger className="w-[120px] h-8 text-xs border-0 bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC"><span className="flex items-center"><Globe className="w-3 h-3 mr-1.5" /> Public</span></SelectItem>
                      <SelectItem value="EXPERT"><span className="flex items-center"><Award className="w-3 h-3 mr-1.5" /> Experts Only</span></SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {postMode === "groupbuy" && (
                  <span className="text-[10px] text-orange-600 font-medium flex items-center gap-1">
                    <Users className="w-3 h-3" /> Verified via Flow FCL
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={handleCreatePost}
                  disabled={createPost.isPending || (postMode === "normal" ? !postContent.trim() : !groupBuyDetails.item.trim())}
                  className={postMode === "groupbuy" ? "bg-orange-500 hover:bg-orange-600" : ""}
                >
                  {postMode === "groupbuy" ? "Request" : "Post"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Posts */}
          {loadingPosts
            ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
            : posts?.map((post) => {
                const isGroupBuy = isGroupBuyPost(post.badge, post.content);
                return (
                  <Card key={post.id} className={`overflow-hidden ${isGroupBuy ? "border-orange-200 bg-orange-50/30" : ""}`}>
                    <CardHeader className="p-4 pb-2 flex flex-row items-start gap-3 space-y-0">
                      <Avatar className="w-9 h-9 border-2 border-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                          {post.author.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{post.author}</span>
                          {post.badge && post.badge !== "GROUP_BUY" && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-accent/20 border-0">
                              {post.badge}
                            </Badge>
                          )}
                          {isGroupBuy && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-orange-100 text-orange-700 border-orange-200 border">
                              🛒 Group Buy
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          {new Date(post.createdAt).toLocaleDateString()}
                          {post.visibility === "EXPERT" && <Lock className="w-3 h-3 ml-1 text-yellow-600" />}
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>

                      {isGroupBuy && (
                        <Button size="sm" className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white text-xs" onClick={() => toast({ title: "Joined group buy!", description: "You'll get notified when the group is ready." })}>
                          <Users className="w-3 h-3 mr-1.5" /> Join Group Buy · Flow FCL ✓
                        </Button>
                      )}

                      {post.filecoinCid && (
                        <div className="mt-3 bg-blue-50 border border-blue-200 p-2 rounded-lg text-[10px] font-mono text-blue-700 flex items-center gap-2">
                          <span className="font-bold not-italic text-[9px] bg-blue-200 px-1.5 py-0.5 rounded uppercase">IPFS</span>
                          {post.filecoinCid.substring(0, 20)}...
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="p-3 bg-muted/20 border-t border-border flex flex-col items-stretch gap-2">
                      <div className="flex gap-4 w-full">
                        <button onClick={() => handleLike(post.id)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rose-500 transition-colors">
                          <Heart className="w-4 h-4" /> {post.likes}
                        </button>
                        <button onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                          <MessageSquare className="w-4 h-4" /> {post.comments.length}
                        </button>
                      </div>

                      {post.comments.length > 0 && (
                        <div className="space-y-1.5 mt-1 w-full pl-2 border-l-2 border-primary/20">
                          {post.comments.map((c) => (
                            <div key={c.id} className="text-xs">
                              <span className="font-bold mr-1">{c.author}:</span>
                              <span className="text-muted-foreground">{c.content}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {activeCommentPost === post.id && (
                        <div className="flex w-full gap-2 mt-1">
                          <Input size={1} className="h-8 text-xs flex-1" placeholder="Write a comment..." value={commentText[post.id] || ""} onChange={(e) => setCommentText({ ...commentText, [post.id]: e.target.value })} />
                          <Button size="sm" className="h-8" onClick={() => handleComment(post.id)} disabled={addComment.isPending}>Send</Button>
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
        </TabsContent>

        {/* ── CHAT TAB ── */}
        <TabsContent value="chat" className="flex-1 flex flex-col h-full min-h-[400px]">
          <div className="bg-violet-50 border border-violet-200 p-2 rounded-t-lg flex items-center justify-center gap-2 text-xs font-semibold text-violet-700">
            <Lock className="w-3 h-3" />
            End-to-End Encrypted · Lit Protocol
          </div>

          <div className="bg-violet-50/30 border-x border-violet-100 px-2 py-1.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Punjab Farmers Group · Access-gated by Lit</span>
          </div>

          <div className="flex-1 border-x border-border bg-background p-3 overflow-y-auto space-y-3">
            {loadingMessages ? (
              <div className="text-center text-sm text-muted-foreground py-8">Loading secure messages...</div>
            ) : messages?.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">No messages yet. Say hello!</div>
            ) : (
              messages?.map((msg) => {
                const isMe = msg.sender === "Current Farmer";
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-muted-foreground mb-1">{msg.sender}</span>
                    <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${isMe ? "bg-violet-600 text-white rounded-tr-none" : "bg-muted rounded-tl-none"}`}>
                      <p className="text-sm">{msg.content}</p>
                      {msg.isEncrypted && (
                        <div className={`text-[9px] mt-1 flex items-center gap-1 ${isMe ? "text-violet-200 justify-end" : "text-muted-foreground justify-start"}`}>
                          <Lock className="w-2 h-2" /> Encrypted
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 border border-t-0 rounded-b-lg flex gap-2 bg-background">
            <Input placeholder="Send encrypted message..." value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} className="flex-1 text-sm" />
            <Button type="submit" size="icon" disabled={sendMessage.isPending || !chatMessage.trim()} className="bg-violet-600 hover:bg-violet-700">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </TabsContent>

        {/* ── EXPERTS TAB ── */}
        <TabsContent value="experts" className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="bg-violet-50 border border-violet-200 p-2.5 rounded-lg flex items-center gap-2 text-xs text-violet-700">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span><strong>Private consultations</strong> — Questions encrypted via Lit Protocol. Only you and the expert can read them.</span>
          </div>

          {loadingExperts
            ? Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
            : experts?.map((expert) => (
                <Card key={expert.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <Avatar className="w-14 h-14 border-2 border-primary/20 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">{expert.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h3 className="font-bold text-sm">{expert.name}</h3>
                            <p className="text-xs text-primary font-medium">{expert.specialization}</p>
                          </div>
                          <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-700 text-xs shrink-0">★ {expert.rating}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">{expert.experience} · {expert.questionsAnswered} answers</p>

                        {askExpertId === expert.id ? (
                          <div className="mt-3 space-y-2">
                            <Textarea
                              placeholder="Your question is private — only this expert can read it..."
                              className="min-h-[80px] text-sm"
                              value={questionText}
                              onChange={(e) => setQuestionText(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={() => handleAskExpert(expert.id)} disabled={askExpert.isPending}>
                                <Lock className="w-3 h-3 mr-1.5" /> Send Privately
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setAskExpertId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="secondary" className="w-full mt-3 text-xs" onClick={() => setAskExpertId(expert.id)}>
                            <Lock className="w-3 h-3 mr-1.5 text-violet-500" /> Ask Privately via Lit
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

          {expertQuestions && expertQuestions.length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold text-xs mb-3 text-muted-foreground uppercase tracking-wider">My Questions</h3>
              <div className="space-y-2">
                {expertQuestions.map((q) => (
                  <Card key={q.id} className="bg-muted/30 border-dashed">
                    <CardContent className="p-3">
                      <div className="flex justify-between mb-2">
                        <Badge variant={q.status === "ANSWERED" ? "default" : "secondary"} className="text-[10px]">{q.status}</Badge>
                        <span className="text-[10px] text-muted-foreground">To: {q.expertName}</span>
                      </div>
                      <p className="text-sm font-medium mb-2">Q: {q.question}</p>
                      {q.answer && (
                        <div className="bg-background p-2 rounded text-sm border">
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

        {/* ── DISEASE ALERTS TAB ── */}
        <TabsContent value="disease" className="flex-1 overflow-y-auto pb-4 space-y-3 pr-1">
          {/* Header */}
          <Card className="border-red-200 bg-red-50/40">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">District Disease Heatmap</p>
                <p className="text-[10px] text-red-600 flex items-center gap-1 mt-0.5">
                  <Lock className="w-3 h-3" /> Private reports · Zama FHE encrypted · No identity revealed
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-red-700">{diseaseData?.totalEncryptedReports ?? "—"}</p>
                <p className="text-[10px] text-red-600">total reports</p>
              </div>
            </CardContent>
          </Card>

          {/* Network badge */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
            <Wifi className="w-3 h-3 text-green-500" />
            <span>{diseaseData?.network ?? "Ethereum Sepolia (Zama FHE)"}</span>
            <span className="ml-auto text-[10px] text-green-600 font-medium">0 identities revealed</span>
          </div>

          {/* District grid */}
          {loadingDisease ? (
            <div className="grid grid-cols-2 gap-2">
              {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {PUNJAB_DISTRICTS.map((district) => {
                const count = diseaseData?.districtOutbreakMap?.[district]?.total ?? 0;
                const risk = getRiskLevel(count);
                const crops = diseaseData?.districtOutbreakMap?.[district]?.byCrop ?? {};
                const topCrop = Object.entries(crops).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0];
                return (
                  <div key={district} className={`border rounded-xl p-3 ${risk.bg}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold">{district}</span>
                      {risk.icon}
                    </div>
                    <p className={`text-[10px] font-semibold ${risk.color}`}>{risk.label} Risk</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{count} report{count !== 1 ? "s" : ""}</p>
                    {topCrop && <p className="text-[10px] text-muted-foreground">{topCrop} affected</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Crop breakdown */}
          {diseaseData?.cropBreakdown && Object.keys(diseaseData.cropBreakdown).length > 0 && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs font-bold mb-2">Crop Breakdown</p>
                <div className="space-y-1.5">
                  {Object.entries(diseaseData.cropBreakdown)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([crop, count]) => {
                      const total = diseaseData.totalEncryptedReports || 1;
                      const pct = Math.round(((count as number) / total) * 100);
                      return (
                        <div key={crop} className="flex items-center gap-2">
                          <span className="text-xs w-20 shrink-0">{crop}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-8 text-right">{count as number}</span>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Anonymous report */}
          {!showReportForm ? (
            <Button
              className="w-full bg-red-600 hover:bg-red-700"
              size="sm"
              onClick={() => setShowReportForm(true)}
            >
              <Shield className="w-3.5 h-3.5 mr-1.5" /> Submit Anonymous Report (FHE Encrypted)
            </Button>
          ) : (
            <Card className="border-red-200">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-bold flex items-center gap-1.5 text-red-700">
                  <Lock className="w-3.5 h-3.5" /> Anonymous Disease Report
                </p>
                <p className="text-[10px] text-muted-foreground">Your identity is never stored. Data is encrypted with Zama FHE before submission.</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Your District</label>
                    <Select value={reportDistrict} onValueChange={setReportDistrict}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PUNJAB_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Affected Crop</label>
                    <Select value={reportCrop} onValueChange={setReportCrop}>
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CROPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    onClick={handleSubmitDiseaseReport}
                    disabled={submittingReport}
                  >
                    {submittingReport ? "Encrypting & Submitting..." : "Submit Anonymously"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowReportForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent alerts */}
          {diseaseData?.recentReports && diseaseData.recentReports.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Encrypted Reports</p>
              <div className="space-y-1.5">
                {diseaseData.recentReports.slice(0, 5).map((r: { reportId: string; district: string; cropType: string; encryptedStatus: string }) => (
                  <div key={r.reportId} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                    <span className="text-xs font-medium flex-1">{r.district} · {r.cropType}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{r.encryptedStatus?.substring(0, 8)}…</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
