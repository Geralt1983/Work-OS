import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ImagePlus, X } from "lucide-react";

export interface ChatInputProps {
  onSendMessage: (message: string, imageBase64?: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = "Tell me about your tasks or what you'd like to do...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ file: File; previewUrl: string; base64: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const previewUrl = URL.createObjectURL(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      setSelectedImage({ file, previewUrl, base64 });
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFileSelect(file);
          break;
        }
      }
    }
  }, [handleFileSelect]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleSubmit = () => {
    const trimmed = message.trim();
    if ((!trimmed && !selectedImage) || disabled) return;

    onSendMessage(trimmed || "What's in this image?", selectedImage?.base64);
    setMessage("");
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage.previewUrl);
      setSelectedImage(null);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleRemoveImage = () => {
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage.previewUrl);
      setSelectedImage(null);
    }
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
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div className="border-t bg-background/95 backdrop-blur-lg p-6">
      <div className="max-w-4xl mx-auto space-y-3">
        {selectedImage && (
          <div className="relative inline-block">
            <img 
              src={selectedImage.previewUrl} 
              alt="Selected" 
              className="h-20 w-20 object-cover rounded-lg border"
            />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
              onClick={handleRemoveImage}
              disabled={disabled}
              data-testid="button-remove-image"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        <div className="flex gap-3 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
            data-testid="input-image-file"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="h-12 w-12 rounded-full shrink-0"
            data-testid="button-add-image"
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedImage ? "Describe what you want to know about this image..." : placeholder}
            disabled={disabled}
            className="min-h-[48px] max-h-[200px] resize-none rounded-xl text-[15px] leading-relaxed"
            rows={1}
            data-testid="input-message"
          />
          <Button
            onClick={handleSubmit}
            disabled={disabled || (!message.trim() && !selectedImage)}
            size="icon"
            className="rounded-full h-12 w-12 shrink-0"
            data-testid="button-send"
          >
            <Send className="h-[18px] w-[18px]" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Paste or drop an image, or click the image button to upload a screenshot
        </p>
      </div>
    </div>
  );
}
