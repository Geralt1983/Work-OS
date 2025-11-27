import { useState, useRef, useEffect, useCallback } from "react";
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
    <div className="glass-strong border-t border-purple-500/20 p-4 sm:p-6 relative">
      {/* Top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      
      <div className="max-w-4xl mx-auto space-y-3">
        {selectedImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedImages.map((img, index) => (
              <div key={`${img.file.name}-${index}`} className="relative inline-block">
                <img 
                  src={img.previewUrl} 
                  alt={`Selected ${index + 1}`} 
                  className="h-20 w-20 object-cover rounded-lg border border-purple-500/30"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                  onClick={() => handleRemoveImage(index)}
                  disabled={disabled}
                  data-testid={`button-remove-image-${index}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
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
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || selectedImages.length >= MAX_IMAGES}
            className="h-12 w-12 rounded-full shrink-0 border border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/10 transition-all"
            data-testid="button-add-image"
          >
            <ImagePlus className="h-5 w-5 text-purple-400" />
          </Button>
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedImages.length > 0 ? "Describe what you want to know about these images..." : placeholder}
              disabled={disabled}
              className="min-h-[48px] max-h-[200px] resize-none rounded-xl text-[15px] leading-relaxed bg-background/50 border-purple-500/30 focus:border-cyan-500/60 focus:ring-cyan-500/20 transition-all"
              rows={1}
              data-testid="input-message"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={disabled || (!message.trim() && selectedImages.length === 0)}
            className="send-button-glow rounded-full h-12 w-12 shrink-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
            data-testid="button-send"
          >
            <Send className="h-[18px] w-[18px] text-white" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Paste, drop, or click to upload images (up to {MAX_IMAGES})
        </p>
      </div>
    </div>
  );
}
