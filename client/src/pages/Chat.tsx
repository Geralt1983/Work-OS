import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassSidebar from "@/components/GlassSidebar";
import ChatMessage, { type ChatMessageProps } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import EmptyState from "@/components/EmptyState";
import TypingIndicator from "@/components/TypingIndicator";
import { TriageDialog } from "@/components/TriageDialog";
import IslandLayout from "@/components/IslandLayout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageSquare, BarChart3, List } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const storedId = localStorage.getItem("work_os_session_id");
    const storedDate = localStorage.getItem("work_os_session_date");
    const today = new Date().toISOString().split('T')[0];
    
    if (storedId && storedDate === today) {
      return storedId;
    }
    localStorage.removeItem("work_os_session_id");
    localStorage.removeItem("work_os_session_date");
    return null;
  });
  const [isConnected, setIsConnected] = useState(true);
  const [triageOpen, setTriageOpen] = useState(false);
  const [hasCheckedBriefing, setHasCheckedBriefing] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (sessionId) {
      const fetchHistory = async () => {
        try {
          const res = await fetch(`/api/sessions/${sessionId}/messages`);
          if (res.ok) {
            const history = await res.json();
            const formattedMessages = history.map((msg: any) => ({
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.timestamp),
              taskCard: msg.taskCard
            }));
            setMessages(formattedMessages);
          }
        } catch (error) {
          console.error("Failed to load history:", error);
        }
      };
      fetchHistory();
    }
  }, [sessionId]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();
        setIsConnected(data.status === "ok");
      } catch (error) {
        setIsConnected(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sessionId || hasCheckedBriefing) return;

    const lastBriefing = localStorage.getItem("last_briefing_date");
    const today = new Date().toISOString().split('T')[0];

    if (lastBriefing !== today) {
      const runBriefing = async () => {
        try {
          localStorage.setItem("last_briefing_date", today);
          setHasCheckedBriefing(true);
          
          await apiRequest("POST", "/api/briefing", { sessionId });
          
          const res = await fetch(`/api/sessions/${sessionId}/messages`);
          if (res.ok) {
            const history = await res.json();
            setMessages(history.map((msg: any) => ({
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.timestamp),
              taskCard: msg.taskCard
            })));
          }
          
          queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
        } catch (e) {
          console.error("Briefing failed", e);
        }
      };
      runBriefing();
    } else {
      setHasCheckedBriefing(true);
    }
  }, [sessionId, hasCheckedBriefing]);

  const handleSendMessage = async (content: string, imagesBase64?: string[]) => {
    const hasImages = imagesBase64 && imagesBase64.length > 0;
    const userMessage: ChatMessageProps = {
      role: "user",
      content: hasImages ? `[${imagesBase64.length > 1 ? 'Images' : 'Image'} attached]\n${content}` : content,
      timestamp: new Date(),
      imagesBase64: imagesBase64,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const res = await apiRequest("POST", "/api/chat", {
        ...(sessionId && { sessionId }),
        message: content,
        ...(hasImages && { imagesBase64 }),
      });
      const response = await res.json() as { sessionId: string; assistantMessage: { content: string; timestamp: string; taskCard?: any } };

      if (!sessionId) {
        setSessionId(response.sessionId);
        localStorage.setItem("work_os_session_id", response.sessionId);
        localStorage.setItem("work_os_session_date", new Date().toISOString().split('T')[0]);
      }

      const aiMessage: ChatMessageProps = {
        role: "assistant",
        content: response.assistantMessage.content,
        timestamp: new Date(response.assistantMessage.timestamp),
        taskCard: response.assistantMessage.taskCard,
      };

      setMessages((prev) => [...prev, aiMessage]);

      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });

    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setMessages((prev) => [...prev, { role: "assistant", content: "I'm having trouble processing that request.", timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleExampleClick = (example: string) => {
    if (example.toLowerCase() === "run triage") {
      setTriageOpen(true);
      return;
    }
    handleSendMessage(example);
  };

  const handleClearChat = () => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem("work_os_session_id");
    setIsTyping(false);
  };

  const springTransition = { type: "spring", stiffness: 300, damping: 30 };

  if (isMobile) {
    return (
      <div className="h-[100dvh] flex flex-col bg-[#030309] text-foreground font-sans overflow-hidden" data-testid="page-chat">
        <header className="h-14 glass-strong border-b border-purple-500/20 flex items-center justify-between px-4 shrink-0 z-50">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <h1 className="text-lg font-display font-semibold tracking-wider text-gradient-purple">Work OS</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="hover:bg-purple-500/10 text-purple-400">
              <MessageSquare className="h-5 w-5" />
            </Button>
            <Link href="/moves">
              <Button variant="ghost" size="icon" className="hover:bg-purple-500/10 text-muted-foreground">
                <List className="h-5 w-5" />
              </Button>
            </Link>
             <Link href="/metrics">
              <Button variant="ghost" size="icon" className="hover:bg-cyan-500/10 text-muted-foreground">
                <BarChart3 className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </header>

        <div className="flex-1 relative overflow-hidden flex flex-col">
          <div 
            ref={scrollAreaRef} 
            className="flex-1 overflow-y-auto scroll-smooth p-4 pb-4" 
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center pb-20">
                 <EmptyState onExampleClick={handleExampleClick} />
              </div>
            ) : (
              <div className="space-y-6">
                <AnimatePresence mode="popLayout">
                  {messages.map((message, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={springTransition}
                    >
                      <ChatMessage {...message} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isTyping && <TypingIndicator />}
              </div>
            )}
          </div>

          <div className="shrink-0 z-20 bg-gradient-to-t from-[#030309] via-[#030309] to-transparent px-2 pt-2 pb-2 w-full safe-area-bottom">
             <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
          </div>
        </div>

        <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-transparent text-slate-200 font-sans" data-testid="page-chat">
      <GlassSidebar onTriageClick={() => setTriageOpen(true)} />

      <IslandLayout>
        <div className="h-full flex flex-col relative">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Chat</h2>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-rose-500'}`} />
            </div>
            <motion.button
              onClick={handleClearChat}
              className="text-sm text-muted-foreground hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-testid="button-clear-chat"
            >
              Clear
            </motion.button>
          </div>

          <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
             {messages.length === 0 ? (
               <div className="h-full flex flex-col justify-center">
                  <EmptyState onExampleClick={handleExampleClick} />
               </div>
             ) : (
               <div className="max-w-3xl mx-auto space-y-6 pb-4">
                 <AnimatePresence mode="popLayout">
                   {messages.map((message, index) => (
                     <motion.div
                       key={index}
                       initial={{ opacity: 0, y: 20 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -20 }}
                       transition={springTransition}
                     >
                       <ChatMessage {...message} />
                     </motion.div>
                   ))}
                 </AnimatePresence>
                 {isTyping && <TypingIndicator />}
               </div>
             )}
          </div>

          <div className="shrink-0 z-20 px-6 pb-6 pt-2">
             <div className="max-w-3xl mx-auto">
                <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
             </div>
          </div>
        </div>
      </IslandLayout>

      <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />
    </div>
  );
}
