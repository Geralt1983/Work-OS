import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2 } from "lucide-react";

interface ImageUploadProps {
  onImageSelected: (file: File, previewUrl: string) => void;
  onImageRemoved: () => void;
  selectedImage: { file: File; previewUrl: string } | null;
  disabled?: boolean;
}

export function ImageUpload({ 
  onImageSelected, 
  onImageRemoved, 
  selectedImage,
  disabled 
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    onImageSelected(file, previewUrl);
  }, [onImageSelected]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

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

  if (selectedImage) {
    return (
      <div className="relative inline-block">
        <img 
          src={selectedImage.previewUrl} 
          alt="Selected" 
          className="h-12 w-12 object-cover rounded-md border"
        />
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
          onClick={onImageRemoved}
          disabled={disabled}
          data-testid="button-remove-image"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
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
        className={isDragging ? "ring-2 ring-primary" : ""}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="button-add-image"
      >
        <ImagePlus className="h-5 w-5" />
      </Button>
    </>
  );
}

interface ImagePreviewProps {
  imageUrl: string;
  className?: string;
}

export function ImagePreview({ imageUrl, className }: ImagePreviewProps) {
  return (
    <div className={`rounded-lg overflow-hidden border ${className || ''}`}>
      <img 
        src={imageUrl} 
        alt="Uploaded" 
        className="max-w-full max-h-64 object-contain"
      />
    </div>
  );
}
