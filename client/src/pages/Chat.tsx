import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { LayoutGrid, BarChart3, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassSidebar from "@/components/GlassSidebar";
import ChatMessage, { type ChatMessageProps } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import EmptyState from "@/components/EmptyState";
import TypingIndicator from "@/components/TypingIndicator";
import { TriageDialog } from "@/components/TriageDialog";
import IslandLayout from "@/components/IslandLayout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [triageOpen, setTriageOpen] = useState(false);
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
      }

      const aiMessage: ChatMessageProps = {
        role: "assistant",
        content: response.assistantMessage.content,
        timestamp: new Date(response.assistantMessage.timestamp),
        taskCard: response.assistantMessage.taskCard,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive",
      });

      const errorMessage: ChatMessageProps = {
        role: "assistant",
        content: "I'm having trouble processing that request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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
    setIsTyping(false);
  };

  const springTransition = {
    type: "spring",
    stiffness: 300,
    damping: 30,
  };

  // Mobile layout - no sidebar
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-[#030309] text-foreground" data-testid="page-chat">
        {/* Mobile Header with Nav */}
        <header className="h-14 glass-strong border-b border-purple-500/20 flex items-center justify-between px-4 shrink-0 relative z-50">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-glow-purple">
              <span className="text-white text-sm font-bold">W</span>
            </div>
            <h1 className="text-lg font-semibold tracking-wider text-gradient-purple">Work OS</h1>
            <div className={`status-dot ${isConnected ? 'status-dot-active' : 'status-dot-offline'}`} />
          </div>
          <div className="flex items-center gap-1">
            <Link href="/moves">
              <Button variant="ghost" size="icon" className="hover:bg-cyan-500/10" data-testid="mobile-link-moves">
                <LayoutGrid className="h-5 w-5 text-cyan-400" />
              </Button>
            </Link>
            <Link href="/metrics">
              <Button variant="ghost" size="icon" className="hover:bg-emerald-500/10" data-testid="mobile-link-metrics">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setTriageOpen(true)}
              className="hover:bg-rose-500/10"
              data-testid="mobile-button-triage"
            >
              <ClipboardCheck className="h-5 w-5 text-rose-400" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden p-3">
          <div className="h-full island flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 overflow-auto">
                <EmptyState onExampleClick={handleExampleClick} />
              </div>
            ) : (
              <div ref={scrollAreaRef} className="flex-1 overflow-auto">
                <div className="px-4 py-4 space-y-4">
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
              </div>
            )}
            <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
          </div>
        </div>

        <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />
      </div>
    );
  }

  // Desktop layout with sidebar
  return (
    <div className="h-screen flex gradient-bg" data-testid="page-chat">
      {/* Glass Sidebar */}
      <GlassSidebar onTriageClick={() => setTriageOpen(true)} />

      {/* Main Content - Floating Island */}
      <IslandLayout>
        <div className="h-full flex flex-col">
          {/* Island Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Chat</h2>
              <div className={`status-dot ${isConnected ? 'status-dot-active' : 'status-dot-offline'}`} />
            </div>
            <motion.button
              onClick={handleClearChat}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-testid="button-clear-chat"
            >
              Clear
            </motion.button>
          </div>

          {/* Chat Content */}
          {messages.length === 0 ? (
            <div className="flex-1 overflow-auto">
              <EmptyState onExampleClick={handleExampleClick} />
            </div>
          ) : (
            <div ref={scrollAreaRef} className="flex-1 overflow-auto">
              <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
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
            </div>
          )}

          {/* Chat Input */}
          <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
        </div>
      </IslandLayout>

      <TriageDialog open={triageOpen} onOpenChange={setTriageOpen} />
    </div>
  );
}
