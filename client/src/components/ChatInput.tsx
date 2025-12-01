import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Send, ImagePlus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Client } from "@shared/schema";

interface SelectedImage {
  file: File;
  previewUrl: string;
  base64: string;
}

export interface ChatInputProps {
  onSendMessage: (message: string, imagesBase64?: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_IMAGES = 5;

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
};

export default function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = "Tell me about your tasks or what you'd like to do...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients } = useQuery<Client[]>({ 
    queryKey: ["/api/clients"],
    staleTime: 5 * 60 * 1000,
  });

  const activeClients = clients?.filter(c => c.isActive === 1) || [];
  
  const filteredClients = activeClients.filter(c => 
    c.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    setSelectedImages(prev => {
      if (prev.length >= MAX_IMAGES) return prev;
      
      const previewUrl = URL.createObjectURL(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setSelectedImages(current => {
          const exists = current.some(img => img.file.name === file.name && img.file.size === file.size);
          if (exists || current.length >= MAX_IMAGES) return current;
          return [...current, { file, previewUrl, base64 }];
        });
      };
      reader.readAsDataURL(file);
      
      return prev;
    });
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    Array.from(items).forEach(item => {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFileSelect(file);
        }
      }
    });
  }, [handleFileSelect]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleSubmit = () => {
    const trimmed = message.trim();
    if ((!trimmed && selectedImages.length === 0) || disabled) return;

    const base64Array = selectedImages.length > 0 ? selectedImages.map(img => img.base64) : undefined;
    onSendMessage(trimmed || "What's in this image?", base64Array);
    setMessage("");
    setShowMentions(false);
    
    selectedImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setSelectedImages([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => {
      const img = prev[index];
      if (img) {
        URL.revokeObjectURL(img.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const checkForMention = (text: string, cursor: number) => {
    const textBeforeCursor = text.slice(0, cursor);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      const query = lastWord.slice(1);
      setMentionQuery(query);
      setShowMentions(true);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (clientName: string) => {
    const textBeforeCursor = message.slice(0, cursorPosition);
    const textAfterCursor = message.slice(cursorPosition);
    
    const lastAtPos = textBeforeCursor.lastIndexOf("@");
    const newTextBefore = textBeforeCursor.slice(0, lastAtPos) + `@${clientName} `;
    
    const newValue = newTextBefore + textAfterCursor;
    setMessage(newValue);
    setShowMentions(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newTextBefore.length, newTextBefore.length);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredClients.length > 0) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(prev => (prev > 0 ? prev - 1 : filteredClients.length - 1));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(prev => (prev < filteredClients.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredClients[mentionIndex].name);
        return;
      }
      if (e.key === "Escape") {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => handleFileSelect(file));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;
    
    setMessage(newValue);
    setCursorPosition(newCursorPos);
    checkForMention(newValue, newCursorPos);
  };

  return (
    <div className="p-4 sm:p-6 relative">
      <div className="max-w-3xl mx-auto space-y-3 relative">
        
        <AnimatePresence>
          {showMentions && filteredClients.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a1b26]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <div className="px-3 py-2 text-xs font-medium text-white/40 border-b border-white/5 uppercase tracking-wider">
                Select Client
              </div>
              <div className="max-h-48 overflow-y-auto py-1 custom-scrollbar">
                {filteredClients.map((client, index) => (
                  <button
                    key={client.id}
                    onClick={() => insertMention(client.name)}
                    data-testid={`mention-client-${client.id}`}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                      index === mentionIndex 
                        ? "bg-purple-500/20 text-white" 
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <div 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: client.color || '#a855f7' }} 
                    />
                    <span className="truncate text-sm font-medium">{client.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedImages.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2 mb-2"
            >
              {selectedImages.map((img, index) => (
                <motion.div 
                  key={`${img.file.name}-${index}`} 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={springTransition}
                  className="relative inline-block"
                >
                  <img 
                    src={img.previewUrl} 
                    alt={`Selected ${index + 1}`} 
                    className="h-16 w-16 object-cover rounded-xl border border-white/10 shadow-lg"
                  />
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md z-10"
                    onClick={() => handleRemoveImage(index)}
                    disabled={disabled}
                    data-testid={`button-remove-image-${index}`}
                  >
                    <X className="h-3 w-3" />
                  </motion.button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          className="relative flex items-end gap-2 p-2 rounded-[24px] bg-[#1a1b26]/80 backdrop-blur-xl border border-white/10 shadow-2xl"
          initial={false}
          animate={{ 
            boxShadow: message.length > 0 || selectedImages.length > 0
              ? "0 0 0 1px rgba(168, 85, 247, 0.3), 0 8px 40px rgba(0, 0, 0, 0.3)" 
              : "0 4px 20px rgba(0, 0, 0, 0.2)"
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleInputChange}
            className="hidden"
            data-testid="input-image-file"
          />
          
          <motion.button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || selectedImages.length >= MAX_IMAGES}
            whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.1)" }}
            whileTap={{ scale: 0.95 }}
            className="h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-muted-foreground hover:text-purple-400 transition-colors disabled:opacity-50"
            data-testid="button-attach-image"
          >
            <ImagePlus className="h-5 w-5" />
          </motion.button>

          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedImages.length > 0 ? "Ask about these images..." : placeholder}
            disabled={disabled}
            className="flex-1 min-h-[40px] max-h-[200px] py-2.5 px-0 resize-none bg-transparent border-0 focus-visible:ring-0 text-[15px] !text-white placeholder:text-white/40 shadow-none"
            rows={1}
            data-testid="input-message"
          />

          <motion.button
            onClick={handleSubmit}
            disabled={disabled || (!message.trim() && selectedImages.length === 0)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`h-10 w-10 rounded-full shrink-0 flex items-center justify-center transition-all ${
              message.trim() || selectedImages.length > 0
                ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-glow-purple"
                : "bg-white/5 text-muted-foreground"
            }`}
            data-testid="button-send"
          >
            <Send className="h-5 w-5" />
          </motion.button>
        </motion.div>

        <p className="text-[10px] text-muted-foreground/40 text-center font-medium tracking-wide uppercase">
          Type @ to mention a client
        </p>
      </div>
    </div>
  );
}
