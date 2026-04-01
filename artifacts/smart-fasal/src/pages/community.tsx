import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Heart, Lock, Globe, Award, Send } from "lucide-react";
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

export default function Community() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Tab 1: Feed State
  const [postContent, setPostContent] = useState("");
  const [postVisibility, setPostVisibility] = useState("PUBLIC");
  const [commentText, setCommentText] = useState<{ [key: number]: string }>({});
  const [activeCommentPost, setActiveCommentPost] = useState<number | null>(null);
  
  // Tab 2: Chat State
  const [chatMessage, setChatMessage] = useState("");

  // Tab 3: Expert State
  const [askExpertId, setAskExpertId] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState("");

  // Queries
  const { data: posts, isLoading: loadingPosts } = useGetCommunityPosts({ query: { queryKey: getGetCommunityPostsQueryKey() } });
  const { data: messages, isLoading: loadingMessages } = useGetCommunityMessages({ query: { queryKey: getGetCommunityMessagesQueryKey() } });
  const { data: experts, isLoading: loadingExperts } = useGetCommunityExperts({ query: { queryKey: getGetCommunityExpertsQueryKey() } });
  const { data: expertQuestions, isLoading: loadingQuestions } = useGetExpertQuestions({ query: { queryKey: getGetExpertQuestionsQueryKey() } });

  // Mutations
  const createPost = useCreateCommunityPost();
  const likePost = useLikeCommunityPost();
  const addComment = useAddCommentToPost();
  const sendMessage = useSendCommunityMessage();
  const askExpert = useAskExpertQuestion();

  const handleCreatePost = () => {
    if (!postContent.trim()) return;
    createPost.mutate({
      data: {
        author: "Current Farmer",
        content: postContent,
        visibility: postVisibility,
      }
    }, {
      onSuccess: () => {
        setPostContent("");
        queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() });
        toast({ title: "Posted successfully" });
      }
    });
  };

  const handleLike = (id: number) => {
    likePost.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCommunityPostsQueryKey() })
    });
  };

  const handleComment = (postId: number) => {
    const text = commentText[postId];
    if (!text?.trim()) return;
    
    addComment.mutate({
      id: postId,
      data: {
        author: "Current Farmer",
        content: text
      }
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
      data: {
        sender: "Current Farmer",
        content: chatMessage
      }
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
      data: {
        question: questionText,
        askedBy: "Current Farmer",
        expertId: expertId
      }
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Community</h2>
        <p className="text-muted-foreground text-sm">Connect, learn, and grow together</p>
      </div>

      <Tabs defaultValue="feed" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="feed" data-testid="tab-feed">Feed</TabsTrigger>
          <TabsTrigger value="chat" data-testid="tab-chat">Web3 Chat</TabsTrigger>
          <TabsTrigger value="experts" data-testid="tab-experts">Experts</TabsTrigger>
        </TabsList>

        {/* FEED TAB */}
        <TabsContent value="feed" className="flex-1 overflow-y-auto pb-4 space-y-4 pr-1">
          {/* Create Post */}
          <Card className="border-primary/20 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <Textarea 
                placeholder="Share an update, ask a question..." 
                className="resize-none border-0 focus-visible:ring-0 px-0 shadow-none"
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
              />
              <div className="flex justify-between items-center pt-2 border-t">
                <Select value={postVisibility} onValueChange={setPostVisibility}>
                  <SelectTrigger className="w-[130px] h-8 text-xs border-0 bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC"><span className="flex items-center"><Globe className="w-3 h-3 mr-2"/> Public</span></SelectItem>
                    <SelectItem value="EXPERT"><span className="flex items-center"><Award className="w-3 h-3 mr-2"/> Experts Only</span></SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleCreatePost} disabled={createPost.isPending || !postContent.trim()} data-testid="button-create-post">
                  Post
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Posts List */}
          <div className="space-y-4">
            {loadingPosts ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
            ) : posts?.map(post => (
              <Card key={post.id} className="overflow-hidden">
                <CardHeader className="p-4 pb-2 flex flex-row items-start gap-3 space-y-0">
                  <Avatar className="w-10 h-10 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {post.author.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{post.author}</span>
                      {post.badge && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-accent/20 text-accent-foreground border-0">
                          {post.badge}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      {new Date(post.createdAt).toLocaleDateString()}
                      {post.visibility === 'EXPERT' && <Lock className="w-3 h-3 ml-1 text-yellow-600"/>}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                  
                  {post.filecoinCid && (
                    <div className="mt-3 bg-muted/50 p-2 rounded text-[10px] font-mono text-muted-foreground flex items-center gap-2 border border-border">
                      <Lock className="w-3 h-3" />
                      Verified on Filecoin: {post.filecoinCid.substring(0, 16)}...
                    </div>
                  )}
                </CardContent>
                <CardFooter className="p-3 bg-muted/20 border-t border-border flex flex-col items-stretch gap-2">
                  <div className="flex gap-4 w-full">
                    <button 
                      onClick={() => handleLike(post.id)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Heart className="w-4 h-4" /> {post.likes}
                    </button>
                    <button 
                      onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" /> {post.comments.length}
                    </button>
                  </div>
                  
                  {post.comments.length > 0 && (
                    <div className="space-y-2 mt-2 w-full pl-2 border-l-2 border-primary/20">
                      {post.comments.map(c => (
                        <div key={c.id} className="text-xs">
                          <span className="font-bold mr-1">{c.author}:</span>
                          <span className="text-muted-foreground">{c.content}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeCommentPost === post.id && (
                    <div className="flex w-full gap-2 mt-2">
                      <Input 
                        size={1} 
                        className="h-8 text-xs flex-1" 
                        placeholder="Write a comment..." 
                        value={commentText[post.id] || ""}
                        onChange={e => setCommentText({...commentText, [post.id]: e.target.value})}
                      />
                      <Button size="sm" className="h-8" onClick={() => handleComment(post.id)} disabled={addComment.isPending}>
                        Send
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* CHAT TAB (Zama Encrypted) */}
        <TabsContent value="chat" className="flex-1 flex flex-col h-full min-h-[400px]">
          <div className="bg-primary/10 border border-primary/20 p-2 rounded-t-lg flex items-center justify-center gap-2 text-xs font-semibold text-primary">
            <Lock className="w-3 h-3" />
            End-to-End Encrypted via Zama FHE
          </div>
          
          <div className="flex-1 border-x border-border bg-background p-4 overflow-y-auto space-y-4">
            {loadingMessages ? (
              <div className="space-y-4 text-center text-muted-foreground">Loading secure chat...</div>
            ) : messages?.map(msg => {
              const isMe = msg.sender === "Current Farmer";
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-muted-foreground mb-1 ml-1">{msg.sender}</span>
                  <div className={`max-w-[85%] rounded-2xl p-3 ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted rounded-tl-none'}`}>
                    <p className="text-sm">{msg.content}</p>
                    {msg.isEncrypted && (
                      <div className={`text-[9px] mt-1 flex items-center gap-1 opacity-70 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <Lock className="w-2 h-2" /> Encrypted
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <form onSubmit={handleSendMessage} className="p-3 border border-t-0 rounded-b-lg flex gap-2 bg-background">
            <Input 
              placeholder="Secure message..." 
              value={chatMessage}
              onChange={e => setChatMessage(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={sendMessage.isPending || !chatMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </TabsContent>

        {/* EXPERTS TAB */}
        <TabsContent value="experts" className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loadingExperts ? (
             Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
          ) : experts?.map(expert => (
            <Card key={expert.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Avatar className="w-16 h-16 border-2 border-accent">
                    <AvatarFallback className="bg-accent/10 text-accent font-bold text-xl">
                      {expert.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold">{expert.name}</h3>
                        <p className="text-xs text-primary font-medium">{expert.specialization}</p>
                      </div>
                      <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-700">★ {expert.rating}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{expert.experience} • {expert.questionsAnswered} answers</p>
                    
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
                      <Button size="sm" variant="secondary" className="w-full mt-3" onClick={() => setAskExpertId(expert.id)}>
                        Ask a Question
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* My Questions Section */}
          {expertQuestions && expertQuestions.length > 0 && (
            <div className="mt-6">
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
