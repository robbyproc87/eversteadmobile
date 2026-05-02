"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, ExternalLink, ChevronLeft, ChevronRight, Plus, ImagePlus, Calendar, FileText } from "lucide-react";
import { MediaUpload } from "@/components/journal/media-upload";
import { useToast } from "@/hooks/use-toast";

interface MediaEntry {
  id: string;
  url: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  createdAt: string;
  entry: {
    id: string;
    content?: string | null;
    mood?: string | null;
    createdAt: string;
  };
}

interface JournalEntry {
  id: string;
  content?: string | null;
  createdAt: string;
}

interface MediaGridProps {
  onOpenEntry: (entryId: string) => void;
}

type AttachMode = "today" | "date" | "entry";

export function MediaGrid({ onOpenEntry }: MediaGridProps) {
  const observerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fabOpen, setFabOpen] = useState(false);
  const [attachMode, setAttachMode] = useState<AttachMode>("today");
  const [customDate, setCustomDate] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [fabEntryId, setFabEntryId] = useState<string | null>(null);
  const [fabMedia, setFabMedia] = useState<any[]>([]);
  const [fabCreating, setFabCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<{ items: MediaEntry[]; nextCursor: string | null }>({
    queryKey: ["journal", "media"],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: "30" });
      if (pageParam) params.set("cursor", pageParam as string);
      const res = await fetch(`/api/journal/media?${params}`);
      if (!res.ok) throw new Error("Failed to fetch media");
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const { data: entriesForPicker = [] } = useQuery<JournalEntry[]>({
    queryKey: ["journal", "list"],
    queryFn: async () => {
      const res = await fetch("/api/journal");
      if (!res.ok) throw new Error("Failed to load journal");
      return res.json();
    },
    enabled: fabOpen && attachMode === "entry",
  });

  useEffect(() => {
    if (!observerRef.current || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allMedia = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data]
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, MediaEntry[]>();
    for (const item of allMedia) {
      const d = new Date(item.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allMedia]);

  const [lightboxItem, setLightboxItem] = useState<MediaEntry | null>(null);

  const lightboxIndex = useMemo(
    () => (lightboxItem ? allMedia.findIndex((m) => m.id === lightboxItem.id) : -1),
    [lightboxItem, allMedia]
  );

  const handlePrev = useCallback(() => {
    if (lightboxIndex > 0) setLightboxItem(allMedia[lightboxIndex - 1]);
  }, [lightboxIndex, allMedia]);

  const handleNext = useCallback(() => {
    if (lightboxIndex < allMedia.length - 1) setLightboxItem(allMedia[lightboxIndex + 1]);
  }, [lightboxIndex, allMedia]);

  useEffect(() => {
    if (!lightboxItem) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") setLightboxItem(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxItem, handlePrev, handleNext]);

  const formatMonth = (key: string) => {
    const [y, m] = key.split("-");
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entriesForPicker.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return entriesForPicker
      .filter((e) => (e.content || "").toLowerCase().includes(q) || new Date(e.createdAt).toLocaleDateString().includes(q))
      .slice(0, 20);
  }, [entriesForPicker, searchQuery]);

  const handleFabProceed = useCallback(async () => {
    setFabCreating(true);
    try {
      let targetDate: string;
      if (attachMode === "today") {
        targetDate = new Date().toISOString();
      } else if (attachMode === "date") {
        if (!customDate) {
          toast({ variant: "destructive", title: "Pick a date", description: "Please select a date first." });
          setFabCreating(false);
          return;
        }
        targetDate = new Date(customDate + "T12:00:00").toISOString();
      } else if (attachMode === "entry" && selectedEntryId) {
        setFabEntryId(selectedEntryId);
        setFabCreating(false);
        toast({ title: "Ready", description: "Now add your photos below." });
        return;
      } else {
        toast({ variant: "destructive", title: "Select an entry", description: "Please choose an entry to attach to." });
        setFabCreating(false);
        return;
      }

      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Photo entry",
          isPrivate: false,
          createdAt: targetDate,
        }),
      });
      if (!res.ok) throw new Error("Failed to create entry");
      const entry = await res.json();
      setFabEntryId(entry.id);
      queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
      queryClient.invalidateQueries({ queryKey: ["stats", "dashboard"] });
      toast({ title: "Ready", description: "Entry created. Now add your photos below." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to create entry." });
    } finally {
      setFabCreating(false);
    }
  }, [attachMode, customDate, selectedEntryId, queryClient, toast]);

  const handleFabClose = useCallback(() => {
    setFabOpen(false);
    setFabEntryId(null);
    setFabMedia([]);
    setAttachMode("today");
    setCustomDate("");
    setSelectedEntryId(null);
    setSearchQuery("");
    if (fabMedia.length > 0 || fabEntryId) {
      queryClient.invalidateQueries({ queryKey: ["journal", "media"] });
      queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
    }
  }, [fabMedia, fabEntryId, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      <Button
        onClick={() => setFabOpen(true)}
        className="fixed bottom-6 right-6 z-40 gap-2 shadow-lg"
        data-testid="media-add-photos"
      >
        <Plus className="h-4 w-4" />
        Add photos
      </Button>

      {allMedia.length === 0 && !fabOpen ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground" data-testid="text-no-media">
              No photos yet. Add images to your journal entries to see them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {grouped.map(([monthKey, items]) => (
            <div key={monthKey} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground" data-testid={`text-month-${monthKey}`}>
                {formatMonth(monthKey)}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setLightboxItem(item)}
                    className="aspect-square rounded-md overflow-visible bg-muted hover-elevate"
                    data-testid={`media-thumb-${item.id}`}
                  >
                    <img
                      src={item.url}
                      alt=""
                      className="w-full h-full object-cover rounded-md"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div ref={observerRef} className="h-4" />

          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      )}

      <Dialog open={!!lightboxItem} onOpenChange={(open) => { if (!open) setLightboxItem(null); }}>
        <DialogContent className="max-w-3xl p-2 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>Image Preview</DialogTitle>
            <DialogDescription>Journal entry photo</DialogDescription>
          </DialogHeader>
          {lightboxItem && (
            <div className="space-y-3">
              <div className="relative flex items-center justify-center min-h-[300px]">
                {lightboxIndex > 0 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute left-1 z-10"
                    onClick={handlePrev}
                    aria-label="Previous image"
                    data-testid="button-lightbox-prev"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}

                <img
                  src={lightboxItem.url}
                  alt=""
                  className="max-h-[70vh] max-w-full object-contain rounded-md"
                  data-testid="img-lightbox"
                />

                {lightboxIndex < allMedia.length - 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 z-10"
                    onClick={handleNext}
                    aria-label="Next image"
                    data-testid="button-lightbox-next"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 px-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {new Date(lightboxItem.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setLightboxItem(null);
                    onOpenEntry(lightboxItem.entry.id);
                  }}
                  data-testid="button-open-entry"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open entry
                </Button>
              </div>

              {lightboxItem.entry.content && (
                <p className="text-sm text-muted-foreground line-clamp-2 px-2">
                  {lightboxItem.entry.content}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={fabOpen} onOpenChange={(open) => { if (!open) handleFabClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{fabEntryId ? "Upload photos" : "Add photos"}</DialogTitle>
            <DialogDescription>
              {fabEntryId ? "Drop or select images to upload." : "Choose where to attach your photos."}
            </DialogDescription>
          </DialogHeader>

          {!fabEntryId ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <button
                  onClick={() => setAttachMode("today")}
                  className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${attachMode === "today" ? "border-primary bg-primary/5" : "border-border"}`}
                  data-testid="fab-attach-today"
                >
                  <ImagePlus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Today</p>
                    <p className="text-xs text-muted-foreground">Create a new entry for today</p>
                  </div>
                </button>

                <button
                  onClick={() => setAttachMode("date")}
                  className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${attachMode === "date" ? "border-primary bg-primary/5" : "border-border"}`}
                  data-testid="fab-attach-date"
                >
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Pick a date</p>
                    <p className="text-xs text-muted-foreground">Create a new entry for a specific date</p>
                  </div>
                </button>

                {attachMode === "date" && (
                  <div className="pl-7">
                    <Input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full"
                      data-testid="input-fab-date"
                    />
                  </div>
                )}

                <button
                  onClick={() => setAttachMode("entry")}
                  className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${attachMode === "entry" ? "border-primary bg-primary/5" : "border-border"}`}
                  data-testid="fab-attach-entry"
                >
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Existing entry</p>
                    <p className="text-xs text-muted-foreground">Attach to an existing journal entry</p>
                  </div>
                </button>

                {attachMode === "entry" && (
                  <div className="pl-7 space-y-2">
                    <Input
                      placeholder="Search entries..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-fab-search"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredEntries.map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => setSelectedEntryId(entry.id)}
                          className={`w-full text-left p-2 rounded-md text-sm transition-colors ${selectedEntryId === entry.id ? "bg-primary/10 border border-primary" : "hover:bg-muted border border-transparent"}`}
                          data-testid={`fab-entry-${entry.id}`}
                        >
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          {entry.content && (
                            <p className="line-clamp-1">{entry.content.slice(0, 60)}</p>
                          )}
                        </button>
                      ))}
                      {filteredEntries.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">No entries found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleFabProceed}
                  disabled={fabCreating || (attachMode === "entry" && !selectedEntryId)}
                  className="gap-2"
                  data-testid="button-fab-proceed"
                >
                  {fabCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <MediaUpload
                entryId={fabEntryId}
                media={fabMedia}
                onMediaChange={setFabMedia}
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleFabClose}
                  disabled={fabMedia.some((m: any) => m.uploading)}
                  data-testid="button-fab-done"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
