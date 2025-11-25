import { useState, useRef, useEffect } from "react";
import ChatHeader from "@/components/ChatHeader";
import ChatMessage, { type ChatMessageProps } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import EmptyState from "@/components/EmptyState";
import TypingIndicator from "@/components/TypingIndicator";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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

  const handleSendMessage = (content: string) => {
    const userMessage: ChatMessageProps = {
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: ChatMessageProps = {
        role: "assistant",
        content: "I've processed your request. Here's what I found:",
        timestamp: new Date(),
        taskCard: Math.random() > 0.5 ? {
          title: content.substring(0, 50),
          taskId: `TASK-${Math.floor(Math.random() * 9000) + 1000}`,
          status: ["To Do", "In Progress", "Done"][Math.floor(Math.random() * 3)],
          dueDate: "Dec 20, 2025",
        } : undefined,
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleExampleClick = (example: string) => {
    handleSendMessage(example);
  };

  const handleClearChat = () => {
    setMessages([]);
    setIsTyping(false);
    console.log("Chat cleared");
  };

  return (
    <div className="h-screen flex flex-col bg-background" data-testid="page-chat">
      <ChatHeader onClearChat={handleClearChat} isConnected={true} />

      {messages.length === 0 ? (
        <EmptyState onExampleClick={handleExampleClick} />
      ) : (
        <ScrollArea ref={scrollAreaRef} className="flex-1">
          <div className="max-w-3xl mx-auto p-4 space-y-4">
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
