import { useState, useRef, useEffect } from "react";
import ChatHeader from "@/components/ChatHeader";
import ChatMessage, { type ChatMessageProps } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import EmptyState from "@/components/EmptyState";
import TypingIndicator from "@/components/TypingIndicator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
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
        setIsConnected(data.clickupConfigured);
      } catch (error) {
        setIsConnected(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async (content: string) => {
    const userMessage: ChatMessageProps = {
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const response = await apiRequest("/api/chat", "POST", {
        sessionId,
        message: content,
      }) as unknown as { sessionId: string; assistantMessage: { content: string; timestamp: string; taskCard?: any } };

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
        content: "I'm having trouble connecting to ClickUp right now. Please check your configuration and try again.",
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

      {messages.length === 0 ? (
        <EmptyState onExampleClick={handleExampleClick} />
      ) : (
        <ScrollArea ref={scrollAreaRef} className="flex-1">
          <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
            {messages.map((message, index) => (
              <ChatMessage key={index} {...message} />
            ))}
            {isTyping && <TypingIndicator />}
          </div>
        </ScrollArea>
      )}

      <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
    </div>
  );
}
