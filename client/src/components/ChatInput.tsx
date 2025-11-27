import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ImagePlus, X } from "lucide-react";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  return (
    <div className="p-4 sm:p-6 border-t border-white/5">
      <div className="max-w-3xl mx-auto space-y-3">
        {/* Image Previews */}
        <AnimatePresence>
          {selectedImages.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2"
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
                    className="h-20 w-20 object-cover rounded-2xl border border-white/10 shadow-lg"
                  />
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-glow-pink"
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

        {/* Input Row */}
        <div className="flex gap-3 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleInputChange}
            className="hidden"
            data-testid="input-image-file"
          />
          
          {/* Image Upload Button */}
          <motion.button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || selectedImages.length >= MAX_IMAGES}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={springTransition}
            className="h-12 w-12 rounded-2xl shrink-0 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 flex items-center justify-center transition-colors disabled:opacity-50"
            data-testid="button-add-image"
          >
            <ImagePlus className="h-5 w-5 text-purple-400" />
          </motion.button>

          {/* Text Input */}
          <motion.div 
            className="flex-1 relative"
            initial={false}
            animate={{ 
              boxShadow: message.length > 0 
                ? "0 8px 32px rgba(168, 85, 247, 0.15)" 
                : "0 4px 16px rgba(0, 0, 0, 0.1)"
            }}
            style={{ borderRadius: "16px" }}
          >
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedImages.length > 0 ? "Describe what you want to know about these images..." : placeholder}
              disabled={disabled}
              className="min-h-[48px] max-h-[200px] resize-none rounded-2xl text-[15px] leading-relaxed bg-white/5 border-white/10 focus:border-purple-500/40 focus:ring-purple-500/20 placeholder:text-muted-foreground/60 transition-all"
              rows={1}
              data-testid="input-message"
            />
          </motion.div>

          {/* Send Button */}
          <motion.button
            onClick={handleSubmit}
            disabled={disabled || (!message.trim() && selectedImages.length === 0)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            transition={springTransition}
            className="h-12 w-12 rounded-2xl shrink-0 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-glow-purple disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            data-testid="button-send"
          >
            <Send className="h-[18px] w-[18px] text-white" />
          </motion.button>
        </div>

        <p className="text-xs text-muted-foreground/60 text-center">
          Paste, drop, or click to upload images (up to {MAX_IMAGES})
        </p>
      </div>
    </div>
  );
}
