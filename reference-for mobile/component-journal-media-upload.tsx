"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { JOURNAL_MEDIA } from "@/lib/constants";

interface MediaItem {
  id: string;
  url: string;
  mimeType: string;
  uploading?: boolean;
  progress?: number;
  localPreview?: string;
  error?: string;
}

interface MediaUploadProps {
  entryId: string | null;
  media: MediaItem[];
  onMediaChange: (media: MediaItem[] | ((prev: MediaItem[]) => MediaItem[])) => void;
  disabled?: boolean;
  autoUploadFiles?: File[] | null;
  onAutoUploadConsumed?: () => void;
}

export function MediaUpload({ entryId, media, onMediaChange, disabled, autoUploadFiles, onAutoUploadConsumed }: MediaUploadProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = (file: File): string | null => {
    if (!(JOURNAL_MEDIA.ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      return `Unsupported file type: ${file.type}`;
    }
    if (file.size > JOURNAL_MEDIA.MAX_FILE_SIZE) {
      return `File too large (max ${JOURNAL_MEDIA.MAX_FILE_SIZE / 1024 / 1024}MB)`;
    }
    return null;
  };

  const uploadFile = useCallback(async (file: File) => {
    if (!entryId) return;

    const error = validateFile(file);
    if (error) {
      toast({ variant: "destructive", title: "Upload error", description: error });
      return;
    }

    if (media.length >= JOURNAL_MEDIA.MAX_ITEMS_PER_ENTRY) {
      toast({
        variant: "destructive",
        title: "Limit reached",
        description: `Max ${JOURNAL_MEDIA.MAX_ITEMS_PER_ENTRY} images per entry`,
      });
      return;
    }

    const localPreview = URL.createObjectURL(file);
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempItem: MediaItem = {
      id: tempId,
      url: "",
      mimeType: file.type,
      uploading: true,
      progress: 0,
      localPreview,
    };

    onMediaChange([...media, tempItem]);

    try {
      const initRes = await fetch(`/api/journal/${entryId}/media?action=upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mime: file.type }),
      });

      if (!initRes.ok) {
        const err = await initRes.json();
        throw new Error(err.error || "Upload init failed");
      }

      const { path, signedUrl, token } = await initRes.json();

      onMediaChange((prev: MediaItem[]) =>
        prev.map((m) => (m.id === tempId ? { ...m, progress: 30 } : m))
      );

      const supabase = createClient();
      if (!supabase) throw new Error("Supabase not available");

      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from(JOURNAL_MEDIA.BUCKET_NAME)
        .uploadToSignedUrl(path, token, new Blob([arrayBuffer], { type: file.type }));

      if (uploadError) {
        if (file.type === "image/heic") {
          throw new Error("HEIC upload failed. Try converting to JPEG or WebP first.");
        }
        throw new Error(uploadError.message);
      }

      onMediaChange((prev: MediaItem[]) =>
        prev.map((m) => (m.id === tempId ? { ...m, progress: 70 } : m))
      );

      let width: number | undefined;
      let height: number | undefined;
      if (file.type.startsWith("image/") && file.type !== "image/heic") {
        try {
          const img = new Image();
          const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = reject;
            img.src = localPreview;
          });
          width = dims.w;
          height = dims.h;
        } catch {}
      }

      const confirmRes = await fetch(`/api/journal/${entryId}/media?action=confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          mime: file.type,
          width,
          height,
          bytes: file.size,
        }),
      });

      if (!confirmRes.ok) throw new Error("Confirm failed");

      const confirmed = await confirmRes.json();

      onMediaChange((prev: MediaItem[]) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                id: confirmed.id,
                url: confirmed.url,
                mimeType: confirmed.mimeType,
                uploading: false,
                progress: 100,
                localPreview,
              }
            : m
        )
      );

      queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
      queryClient.invalidateQueries({ queryKey: ["journal", "entry", entryId] });
      queryClient.invalidateQueries({ queryKey: ["journal", "media"] });
      queryClient.invalidateQueries({ queryKey: ["stats", "dashboard"] });
    } catch (err: any) {
      onMediaChange((prev: MediaItem[]) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, uploading: false, error: err.message } : m
        )
      );
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err.message || "Failed to upload image",
      });
    }
  }, [entryId, media, onMediaChange, toast, queryClient]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files);
    for (const file of fileArr) {
      uploadFile(file);
    }
  }, [uploadFile]);

  useEffect(() => {
    if (autoUploadFiles && autoUploadFiles.length > 0 && entryId) {
      handleFiles(autoUploadFiles);
      onAutoUploadConsumed?.();
    }
  }, [autoUploadFiles, entryId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleRemove = useCallback(async (item: MediaItem) => {
    if (item.uploading) return;

    if (item.error || item.id.startsWith("temp-")) {
      onMediaChange(media.filter((m) => m.id !== item.id));
      if (item.localPreview) URL.revokeObjectURL(item.localPreview);
      return;
    }

    if (!entryId) return;

    try {
      const res = await fetch(`/api/journal/${entryId}/media/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");

      onMediaChange(media.filter((m) => m.id !== item.id));
      if (item.localPreview) URL.revokeObjectURL(item.localPreview);

      queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
      queryClient.invalidateQueries({ queryKey: ["journal", "entry", entryId] });
      queryClient.invalidateQueries({ queryKey: ["journal", "media"] });
      queryClient.invalidateQueries({ queryKey: ["stats", "dashboard"] });

      toast({ title: "Removed", description: "Image removed from entry." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to remove image." });
    }
  }, [entryId, media, onMediaChange, toast, queryClient]);

  const isUploading = media.some((m) => m.uploading);

  return (
    <div className="space-y-3">
      <div
        className={`
          border-2 border-dashed rounded-md p-4 text-center transition-colors cursor-pointer
          ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
          ${disabled ? "opacity-50 pointer-events-none" : ""}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        data-testid="dropzone-media"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
          data-testid="input-media-file"
        />
        <div className="flex flex-col items-center gap-2 py-2">
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isDragOver ? "Drop images here" : "Add photos (drag & drop or click)"}
          </p>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP, HEIC. Max {JOURNAL_MEDIA.MAX_FILE_SIZE / 1024 / 1024}MB each.
          </p>
        </div>
      </div>

      {media.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative group w-20 h-20 rounded-md overflow-visible bg-muted"
              data-testid={`media-chip-${item.id}`}
            >
              {(item.localPreview || item.url) && (
                <img
                  src={item.localPreview || item.url}
                  alt=""
                  className="w-full h-full object-cover rounded-md"
                />
              )}

              {item.uploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  {item.progress !== undefined && (
                    <Progress value={item.progress} className="w-14 h-1 mt-1" />
                  )}
                </div>
              )}

              {item.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-destructive/40 rounded-md">
                  <span className="text-[10px] text-white font-medium px-1">Failed</span>
                </div>
              )}

              {!item.uploading && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(item); }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                  data-testid={`button-remove-media-${item.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isUploading && (
        <p className="text-xs text-muted-foreground">
          Uploading... Please wait before saving.
        </p>
      )}
    </div>
  );
}
