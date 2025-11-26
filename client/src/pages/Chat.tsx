import { useState, useRef, useEffect } from "react";
import ChatHeader from "@/components/ChatHeader";
import ChatMessage, { type ChatMessageProps } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import EmptyState from "@/components/EmptyState";
import TypingIndicator from "@/components/TypingIndicator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
    handleSendMessage(example);
  };

  const handleClearChat = () => {
    setMessages([]);
    setSessionId(null);
    setIsTyping(false);
  };

  return (
    <div className="h-screen flex flex-col bg-background" data-testid="page-chat">
      <ChatHeader onClearChat={handleClearChat} isConnected={isConnected} />

      <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
        {messages.length === 0 ? (
          <div className="h-full overflow-auto overscroll-contain">
            <EmptyState onExampleClick={handleExampleClick} />
          </div>
        ) : (
          <div ref={scrollAreaRef} className="h-full overflow-auto overscroll-contain">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-4">
              {messages.map((message, index) => (
                <ChatMessage key={index} {...message} />
              ))}
              {isTyping && <TypingIndicator />}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t bg-background">
        <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
      </div>
    </div>
  );
}
