"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { InkPadHandles, TemplateSection } from "@/components/journal/ink-pad";
import { JournalCalendar } from "@/components/journal/journal-calendar";
import { MediaUpload } from "@/components/journal/media-upload";
import { MediaGrid } from "@/components/journal/media-grid";
import { JournalPaper } from "@/components/journal/journal-paper";
import { JournalBottomToolbar } from "@/components/journal/journal-bottom-toolbar";
import { AutosaveIndicator } from "@/components/journal/autosave-indicator";
import { TemplatePicker, getDefaultTemplate } from "@/components/journal/template-picker";
import { JournalAIPromptCard } from "@/components/journal/journal-ai-prompt-card";
import { getTemplateDoc, getTemplateById, getTemplateName } from "@/lib/journal/templates";
import type { JournalTemplate } from "@/lib/journal/templates";

import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { useToast } from "@/hooks/use-toast";
import { usePhotoUpload } from "@/hooks/use-photo-upload";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sparkles,
  Lock,
  LockOpen,
  Loader2,
  PenLine,
  Type,
  CalendarDays,
  List,
  ArrowLeft,
  Plus,
  ImageIcon,
  Camera,
  Search,
  FileText,
  Download,
  X,
  Mic,
} from "lucide-react";
import type { InkPoint, InkStroke } from "@/lib/dexie";
import type { Editor } from "@tiptap/react";
import { JOURNAL_MEDIA } from "@/lib/constants";
import { usePlan } from "@/hooks/usePlan";
import { UpgradePrompt } from "@/components/plan/UpgradePrompt";

const InkPad = dynamic(
  () => import("@/components/journal/ink-pad").then((m) => ({ default: m.InkPad })),
  { ssr: false, loading: () => <div className="w-full h-[400px] journal-paper rounded-sm" /> }
);

const JournalTiptapEditor = dynamic(
  () => import("@/components/journal/journal-tiptap-editor").then((m) => ({ default: m.JournalTiptapEditor })),
  { ssr: false, loading: () => null }
);

function extractTemplateSections(templateId: string | null): TemplateSection[] {
  if (!templateId || templateId === "blank") return [];
  const template = getTemplateById(templateId);
  if (!template) return [];
  const sections: TemplateSection[] = [];
  let currentHeading: string | null = null;
  for (const node of template.doc.content) {
    if (node.type === "heading" && node.content?.[0]) {
      if (currentHeading) sections.push({ heading: currentHeading });
      currentHeading = (node.content[0] as { text: string }).text;
    } else if (node.type === "paragraph" && (node.attrs as Record<string, unknown>)?.["data-ph"] && currentHeading) {
      sections.push({ heading: currentHeading, prompt: (node.attrs as Record<string, unknown>)["data-ph"] as string });
      currentHeading = null;
    }
  }
  if (currentHeading) sections.push({ heading: currentHeading });
  return sections;
}

interface MediaThumb {
  id: string;
  url: string;
  mimeType: string;
  durationS?: number | null;
  storagePath?: string;
}

interface JournalEntry {
  id: string;
  userId: string;
  title?: string | null;
  content?: string | null;
  contentRich?: Record<string, unknown> | null;
  contentPlainText?: string | null;
  inkData?: InkStroke[];
  canvasData?: InkStroke[][];
  mood?: string | null;
  tags: string[];
  isPrivate: boolean;
  templateId?: string | null;
  transcriptionStatus?: string | null;
  pageCount?: number;
  createdAt: string;
  updatedAt: string;
  hasMedia?: boolean;
  mediaCount?: number;
  media?: MediaThumb[];
}

const INK_TOOL_COLOR: Record<string, string> = {
  pen: "#1a1a1a",
  pencil: "#6B7280",
  highlighter: "#FCD34D",
};

export default function JournalPage() {
  return (
    <QueryErrorBoundary fallbackMessage="Unable to load your journal. Please try again.">
      <Suspense fallback={
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <JournalContent />
      </Suspense>
    </QueryErrorBoundary>
  );
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const parts: { text: string; highlight: boolean }[] = [];
  const lc = text.toLowerCase();
  const qlc = query.toLowerCase();
  let lastIdx = 0;
  let idx = lc.indexOf(qlc, lastIdx);
  while (idx !== -1) {
    if (idx > lastIdx) parts.push({ text: text.slice(lastIdx, idx), highlight: false });
    parts.push({ text: text.slice(idx, idx + query.length), highlight: true });
    lastIdx = idx + query.length;
    idx = lc.indexOf(qlc, lastIdx);
  }
  if (lastIdx < text.length) parts.push({ text: text.slice(lastIdx), highlight: false });
  if (parts.length === 0) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark key={i} className="bg-primary/30 text-inherit rounded-sm px-0.5">{p.text}</mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

const MOOD_OPTIONS = [
  { value: "HAPPY", label: "Happy", selectedClass: "bg-green-500/20 border-green-500 text-green-400" },
  { value: "CALM", label: "Calm", selectedClass: "bg-blue-500/20 border-blue-500 text-blue-400" },
  { value: "SAD", label: "Sad", selectedClass: "bg-indigo-500/20 border-indigo-500 text-indigo-400" },
  { value: "ANXIOUS", label: "Anxious", selectedClass: "bg-amber-500/20 border-amber-500 text-amber-400" },
  { value: "ENERGETIC", label: "Energetic", selectedClass: "bg-orange-500/20 border-orange-500 text-orange-400" },
  { value: "TIRED", label: "Tired", selectedClass: "bg-gray-500/20 border-gray-500 text-gray-400" },
  { value: "GRATEFUL", label: "Grateful", selectedClass: "bg-yellow-500/20 border-yellow-500 text-yellow-400" },
  { value: "FRUSTRATED", label: "Frustrated", selectedClass: "bg-red-500/20 border-red-500 text-red-400" },
  { value: "NEUTRAL", label: "Neutral", selectedClass: "bg-slate-500/20 border-slate-500 text-slate-400" },
];

const AUTOSAVE_DELAY = 1500;

function JournalContent() {
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") === "true";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isFree } = usePlan();

  const [viewMode, setViewMode] = useState<"calendar" | "list" | "media">(isNew ? "list" : "calendar");
  const [editorOpen, setEditorOpen] = useState(false);
  const newEntryHandledRef = useRef(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<JournalEntry[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const navSourceRef = useRef<"day-entry" | null>(null);
  const [inputMode, setInputMode] = useState<"type" | "write">("type");
  const [entryTitle, setEntryTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [contentRichState, setContentRichState] = useState<Record<string, unknown> | null>(null);
  const tiptapEditorRef = useRef<Editor | null>(null);
  const [tiptapEditorInstance, setTiptapEditorInstance] = useState<Editor | null>(null);
  const [inkPages, setInkPages] = useState<InkStroke[][]>([[]]);
  const inkPadRef = useRef<InkPadHandles | null>(null);
  const [inkTool, setInkTool] = useState<"pen" | "pencil" | "highlighter" | "eraser">("pen");
  const [inkSize, setInkSize] = useState(4);
  const [inkCustomColor, setInkCustomColor] = useState<string | null>(null);
  const [inkCanUndo, setInkCanUndo] = useState(false);
  const [inkCanRedo, setInkCanRedo] = useState(false);

  const inkColor = inkTool === "eraser" ? "#1a1a1a" : (inkCustomColor ?? INK_TOOL_COLOR[inkTool] ?? "#1a1a1a");
  const inkIsEraser = inkTool === "eraser";
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [journalPrompt, setJournalPrompt] = useState<string | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  const [entryId, setEntryId] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaThumb[]>([]);
  const addPhotosInputRef = useRef<HTMLInputElement>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const isCreatingRef = useRef(false);
  const pendingBackRef = useRef(false);

  const photoUpload = usePhotoUpload({
    onComplete: () => {
      queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
    },
  });

  const entryPhotoInputRef = useRef<HTMLInputElement>(null);
  const [entryPhotoTargetId, setEntryPhotoTargetId] = useState<string | null>(null);

  const [dayPhotosDialogOpen, setDayPhotosDialogOpen] = useState(false);
  const [dayPhotosAttachMode, setDayPhotosAttachMode] = useState<"recent" | "pick" | "new">("recent");
  const [dayPhotosPickedEntryId, setDayPhotosPickedEntryId] = useState<string | null>(null);
  const dayPhotosInputRef = useRef<HTMLInputElement>(null);
  const [showJournalUpgrade, setShowJournalUpgrade] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateDoc, setTemplateDoc] = useState<Record<string, unknown> | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [transcriptionEntryId, setTranscriptionEntryId] = useState<string | null>(null);
  const [entryTags, setEntryTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [isEntryLocked, setIsEntryLocked] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const [voiceMode, setVoiceMode] = useState<"vtt" | "recording">("vtt");
  const [isVoiceCapturing, setIsVoiceCapturing] = useState(false);
  const [voiceCaptureElapsed, setVoiceCaptureElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureStartRef = useRef<number>(0);

  const JOURNAL_FREE_LIMIT = 30;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (editorOpen) {
      document.body.setAttribute("data-journal-editor", "open");
    } else {
      document.body.removeAttribute("data-journal-editor");
    }
    return () => document.body.removeAttribute("data-journal-editor");
  }, [editorOpen]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (captureTimerRef.current) {
        clearInterval(captureTimerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (isNew && !newEntryHandledRef.current) {
      newEntryHandledRef.current = true;
      window.history.replaceState({}, "", "/journal");
      handleNewEntry();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["journal", "list"],
    queryFn: async () => {
      const res = await fetch("/api/journal");
      if (!res.ok) throw new Error("Failed to load journal");
      return res.json();
    },
  });

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach((e) => e.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (activeTagFilter) {
      result = result.filter((e) => e.tags?.includes(activeTagFilter));
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((e) => {
        const text = e.contentPlainText || e.content || "";
        return (
          (e.title && e.title.toLowerCase().includes(q)) ||
          text.toLowerCase().includes(q) ||
          (e.mood && e.mood.toLowerCase().includes(q)) ||
          (e.tags && e.tags.some((t) => t.toLowerCase().includes(q)))
        );
      });
    }
    return result;
  }, [entries, debouncedSearch, activeTagFilter]);

  const thisMonthEntryCount = useMemo(() => {
    const now = new Date();
    return entries.filter((e) => {
      const d = new Date(e.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [entries]);

  const invalidateCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
    queryClient.invalidateQueries({ queryKey: ["stats", "dashboard"] });
  }, [queryClient]);

  const entryIdRef = useRef(entryId);
  entryIdRef.current = entryId;

  const editorStateRef = useRef({ entryTitle, isPrivate, selectedMood, inputMode, textContent, contentRichState, inkPages, entryTags });
  editorStateRef.current = { entryTitle, isPrivate, selectedMood, inputMode, textContent, contentRichState, inkPages, entryTags };

  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const selectedEntriesRef = useRef(selectedEntries);
  selectedEntriesRef.current = selectedEntries;
  const backTargetRef = useRef<{ date: Date; entries: JournalEntry[] } | null>(null);

  const SAVE_TIMEOUT = 10000;

  const scheduleAutosaveRef = useRef<(() => void) | null>(null);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!tiptapEditorRef.current) {
      toast({ variant: "destructive", title: "Editor not ready", description: "Please wait for the editor to load." });
      return;
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const win = typeof window !== "undefined" ? window : null;
    const SpeechRecognitionAPI = win
      ? (win as Record<string, unknown>).SpeechRecognition || (win as Record<string, unknown>).webkitSpeechRecognition
      : null;
    if (!SpeechRecognitionAPI) {
      toast({ variant: "destructive", title: "Not supported", description: "Voice input is not supported in this browser." });
      return;
    }
    const recognition = new (SpeechRecognitionAPI as { new(): Record<string, unknown> })();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: Record<string, unknown>) => {
      const e = event as { resultIndex: number; results: { length: number; [k: number]: { isFinal: boolean; 0: { transcript: string } } } };
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          const editor = tiptapEditorRef.current;
          if (editor) {
            editor.chain().focus().insertContent(transcript + " ").run();
          }
        }
      }
    };
    recognition.onerror = () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsRecording(false);
      setTimeout(() => { scheduleAutosaveRef.current?.(); }, 50);
    };
    recognitionRef.current = recognition as { stop: () => void };
    (recognition.start as () => void)();
    setIsRecording(true);
  }, [toast]);

  const stopVoiceCapture = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    setIsVoiceCapturing(false);
  }, []);

  const startVoiceCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaChunksRef.current = [];
      captureStartRef.current = Date.now();
      setVoiceCaptureElapsed(0);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) mediaChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(mediaChunksRef.current, { type: "audio/webm" });
        const durationS = Math.round((Date.now() - captureStartRef.current) / 1000);
        mediaChunksRef.current = [];

        let targetEntryId = entryIdRef.current;
        if (!targetEntryId) {
          try {
            const res = await fetch("/api/journal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: "",
                contentRich: {},
                contentPlainText: "",
                mood: null,
                isPrivate: false,
                tags: [],
              }),
            });
            if (!res.ok) throw new Error("Failed to create entry");
            const entry = await res.json();
            targetEntryId = entry.id;
            setEntryId(entry.id);
            entryIdRef.current = entry.id;
          } catch {
            toast({ variant: "destructive", title: "Error", description: "Failed to create entry for recording." });
            return;
          }
        }

        try {
          const initRes = await fetch(`/api/journal/${targetEntryId}/media?action=upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mime: "audio/webm" }),
          });
          if (!initRes.ok) throw new Error("Upload init failed");
          const { path, token } = await initRes.json();

          const supabase = (await import("@/lib/supabase/client")).createClient();
          if (!supabase) throw new Error("Supabase not available");
          const { error: uploadError } = await supabase.storage
            .from(JOURNAL_MEDIA.BUCKET_NAME)
            .uploadToSignedUrl(path, token, blob);
          if (uploadError) throw new Error(uploadError.message);

          const confirmRes = await fetch(`/api/journal/${targetEntryId}/media?action=confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, mime: "audio/webm", bytes: blob.size, durationS }),
          });
          if (!confirmRes.ok) throw new Error("Confirm failed");
          const confirmed = await confirmRes.json();

          setMediaItems((prev) => [...prev, { ...confirmed, url: confirmed.url }]);
          queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
          queryClient.invalidateQueries({ queryKey: ["journal", "media"] });
          toast({ title: "Voice recording saved" });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Could not upload recording.";
          toast({ variant: "destructive", title: "Upload failed", description: msg });
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsVoiceCapturing(true);

      captureTimerRef.current = setInterval(() => {
        setVoiceCaptureElapsed(Math.round((Date.now() - captureStartRef.current) / 1000));
      }, 1000);
    } catch {
      toast({ variant: "destructive", title: "Microphone access denied", description: "Please allow microphone access to record." });
    }
  }, [toast, queryClient]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (isVoiceCapturing) {
      stopVoiceCapture();
      return;
    }
    if (voiceMode === "vtt") {
      startRecording();
    } else {
      startVoiceCapture();
    }
  }, [voiceMode, isRecording, stopRecording, startRecording, isVoiceCapturing, stopVoiceCapture, startVoiceCapture]);

  const resetEditor = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { mediaRecorderRef.current.stop(); }
    if (captureTimerRef.current) { clearInterval(captureTimerRef.current); captureTimerRef.current = null; }
    setIsRecording(false);
    setIsVoiceCapturing(false);
    setVoiceCaptureElapsed(0);
    const backTarget = backTargetRef.current;
    backTargetRef.current = null;
    navSourceRef.current = null;
    setEntryTitle("");
    setTextContent("");
    setContentRichState(null);
    tiptapEditorRef.current = null;
    setTiptapEditorInstance(null);
    setInkPages([[]]);
    setInkTool("pen");
    setInkSize(4);
    setInkCustomColor(null);
    setInkCanUndo(false);
    setInkCanRedo(false);
    setIsPrivate(false);
    setSelectedMood(null);
    setAiInsights(null);
    setJournalPrompt(null);
    setEditorOpen(false);
    if (backTarget) {
      setSelectedDate(backTarget.date);
      setSelectedEntries(backTarget.entries);
    } else {
      setSelectedDate(null);
      setSelectedEntries([]);
    }
    setEntryId(null);
    setMediaItems([]);
    setSelectedTemplateId(null);
    setTemplateDoc(null);
    setIsTranscribing(false);
    setTranscribedText(null);
    setTranscriptionEntryId(null);
    setEntryTags([]);
    setTagInput("");
    setIsEntryLocked(false);
    setIsUnlocked(false);
    stopRecording();
    setAutosaveStatus("idle");
    isSavingRef.current = false;
    isCreatingRef.current = false;
    pendingBackRef.current = false;
  }, []);

  const triggerTranscription = useCallback(async (targetEntryId: string) => {
    try {
      const pngs = await inkPadRef.current?.exportPages();
      if (!pngs || pngs.length === 0) return;

      queryClient.setQueryData<JournalEntry[]>(["journal", "list"], (old) =>
        old?.map((e) => e.id === targetEntryId ? { ...e, transcriptionStatus: "pending" } : e)
      );

      fetch("/api/journal/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: targetEntryId, pages: pngs }),
      }).then(() => {
        invalidateCaches();
      }).catch(() => {});
    } catch {}
  }, [invalidateCaches, queryClient]);


  const doSave = useCallback(async (id: string) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setAutosaveStatus("saving");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SAVE_TIMEOUT);
    const { entryTitle: title, isPrivate: priv, selectedMood: mood, inputMode: mode, textContent: text, contentRichState: richDoc, inkPages: pgs, entryTags: tags } = editorStateRef.current;
    try {
      const body: Record<string, unknown> = {
        title,
        isPrivate: priv,
        mood: mood || undefined,
        tags,
      };
      if (isUnlocked) body.forceUnlock = true;
      if (mode === "type") {
        body.contentRich = richDoc;
        body.contentPlainText = text;
      } else {
        body.canvasData = pgs;
        body.pageCount = pgs.length;
      }

      const res = await fetch(`/api/journal/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Save failed");
      setAutosaveStatus("saved");
      invalidateCaches();
    } catch {
      setAutosaveStatus("error");
    } finally {
      clearTimeout(timeout);
      isSavingRef.current = false;
      if (pendingBackRef.current) {
        if (mode === "write" && pgs.some((p) => p.length > 0)) {
          triggerTranscription(id);
        }
        pendingBackRef.current = false;
        invalidateCaches();
        resetEditor();
      }
    }
  }, [invalidateCaches, resetEditor, triggerTranscription]);

  const createEntry = useCallback(async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setAutosaveStatus("saving");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SAVE_TIMEOUT);
    const { entryTitle: title, isPrivate: priv, selectedMood: mood, inputMode: mode, textContent: text, contentRichState: richDoc, inkPages: pgs, entryTags: tags } = editorStateRef.current;
    let createdId: string | null = null;
    try {
      const body: Record<string, unknown> = {
        title,
        isPrivate: priv,
        mood: mood || undefined,
        tags,
        templateId: selectedTemplateId || undefined,
      };
      if (mode === "type") {
        body.contentRich = richDoc;
        body.contentPlainText = text;
      } else {
        body.canvasData = pgs;
        body.pageCount = pgs.length;
      }

      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Create failed");
      const data = await res.json();
      createdId = data.id;
      setEntryId(data.id);
      setAutosaveStatus("saved");
      invalidateCaches();

      return data.id as string;
    } catch {
      setAutosaveStatus("error");
      return null;
    } finally {
      clearTimeout(timeout);
      isCreatingRef.current = false;
      if (pendingBackRef.current) {
        if (mode === "write" && pgs.some((p) => p.length > 0) && createdId) {
          triggerTranscription(createdId);
        }
        pendingBackRef.current = false;
        invalidateCaches();
        resetEditor();
      }
    }
  }, [invalidateCaches, triggerTranscription, resetEditor]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(async () => {
      const currentId = entryIdRef.current;
      if (currentId) {
        await doSave(currentId);
      } else {
        const { textContent: text, inkPages: pgs } = editorStateRef.current;
        const hasAny = text.length > 0 || pgs.some((p) => p.length > 0);
        if (hasAny) {
          await createEntry();
        }
      }
    }, AUTOSAVE_DELAY);
  }, [doSave, createEntry]);

  scheduleAutosaveRef.current = scheduleAutosave;

  useEffect(() => {
    if (!editorOpen) return;
    if (isEntryLocked && !isUnlocked) return;
    if (isRecording) return;
    scheduleAutosave();
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [editorOpen, textContent, contentRichState, inkPages, selectedMood, isPrivate, entryTitle, entryTags, scheduleAutosave, isEntryLocked, isUnlocked, isRecording]);

  const aiMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/ai/journal-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Failed to get insights");
      return response.json();
    },
    onSuccess: (data) => {
      setAiInsights(data.insights || []);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to get AI insights." });
    },
  });


  const handleBack = useCallback(() => {
    if (isSavingRef.current || isCreatingRef.current) {
      pendingBackRef.current = true;
      return;
    }
    const currentId = entryIdRef.current;
    const { textContent: text, inkPages: pgs } = editorStateRef.current;
    const hasInk = pgs.some((p) => p.length > 0);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    if (currentId && (text.length > 0 || hasInk)) {
      pendingBackRef.current = true;
      doSave(currentId);
      return;
    }
    if (!currentId && (text.length > 0 || hasInk)) {
      pendingBackRef.current = true;
      createEntry();
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
    queryClient.invalidateQueries({ queryKey: ["journal", "media"] });
    queryClient.invalidateQueries({ queryKey: ["stats", "dashboard"] });
    if (currentId) {
      queryClient.invalidateQueries({ queryKey: ["journal", "entry", currentId] });
    }
    resetEditor();
  }, [doSave, createEntry, resetEditor, queryClient]);

  const handleConvertToText = useCallback(async (targetEntryId: string, entry: JournalEntry) => {
    setIsTranscribing(true);
    setTranscribedText(null);
    setTranscriptionEntryId(targetEntryId);
    try {
      const pagesData = entry.canvasData || (entry.inkData ? [entry.inkData] : null);
      if (!pagesData) return;

      const tempCanvases: string[] = [];
      const dpr = window.devicePixelRatio || 1;
      const { getStroke } = await import("perfect-freehand");
      for (const pageStrokes of pagesData) {
        if (!pageStrokes || pageStrokes.length === 0) continue;
        const canvas = document.createElement("canvas");
        canvas.width = 800 * dpr;
        canvas.height = 1056 * dpr;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.scale(dpr, dpr);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 800, 1056);
        for (const stroke of pageStrokes) {
          const outline = getStroke(
            stroke.points.map((p: InkPoint) => [p.x, p.y, p.p ?? 0.5]),
            { size: stroke.size, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }
          );
          if (outline.length === 0) continue;
          const d: Array<string | number> = ["M", ...outline[0], "Q"];
          for (let i = 0; i < outline.length; i++) {
            const [x0, y0] = outline[i];
            const [x1, y1] = outline[(i + 1) % outline.length];
            d.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
          }
          d.push("Z");
          const path = new Path2D(d.join(" "));
          ctx.fillStyle = stroke.color;
          ctx.fill(path);
        }
        tempCanvases.push(canvas.toDataURL("image/png"));
      }

      if (tempCanvases.length === 0) {
        toast({ variant: "destructive", title: "No content", description: "No handwriting found to transcribe." });
        return;
      }

      const res = await fetch("/api/journal/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: targetEntryId, pages: tempCanvases }),
      });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      setTranscribedText(data.text || "No text could be transcribed.");
      invalidateCaches();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to transcribe handwriting." });
    } finally {
      setIsTranscribing(false);
    }
  }, [toast, invalidateCaches]);

  const handleJournalPrompt = async () => {
    if (isFree) {
      setShowJournalUpgrade(true);
      return;
    }
    setIsLoadingPrompt(true);
    try {
      const res = await fetch("/api/journal/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: selectedMood || undefined,
          templateId: selectedTemplateId || undefined,
        }),
      });
      if (res.status === 402) {
        setShowJournalUpgrade(true);
        return;
      }
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.prompt) {
        setJournalPrompt(data.prompt);
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to get journal prompt." });
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const handleAIReflect = () => {
    if (isPrivate) {
      toast({ variant: "destructive", title: "Private entry", description: "AI insights are disabled for private entries." });
      return;
    }
    if (inputMode === "type" && textContent.length < 10) {
      toast({ variant: "destructive", title: "Not enough content", description: "Write at least 10 characters for AI insights." });
      return;
    }
    aiMutation.mutate(textContent);
  };

  const openEntryForEdit = useCallback((entry: JournalEntry, fromDayView?: boolean) => {
    if (fromDayView && selectedDateRef.current && selectedEntriesRef.current.length > 0) {
      backTargetRef.current = { date: selectedDateRef.current, entries: selectedEntriesRef.current };
    } else {
      backTargetRef.current = null;
    }
    navSourceRef.current = fromDayView ? "day-entry" : null;
    setSelectedEntries([entry]);
    setSelectedDate(new Date(entry.createdAt));
    setEntryId(entry.id);
    setEntryTitle(entry.title || "");
    setIsPrivate(entry.isPrivate);
    setSelectedMood(entry.mood || null);
    setSelectedTemplateId(entry.templateId || null);
    setEntryTags(entry.tags || []);
    const hasCanvas = entry.canvasData || entry.inkData;
    setInputMode(hasCanvas ? "write" : "type");
    setTextContent(entry.contentPlainText || entry.content || "");
    setContentRichState(entry.contentRich || null);
    if (entry.canvasData && Array.isArray(entry.canvasData)) {
      setInkPages(entry.canvasData as InkStroke[][]);
    } else if (entry.inkData && Array.isArray(entry.inkData)) {
      const migratedPages: InkStroke[][] = [entry.inkData as InkStroke[]];
      setInkPages(migratedPages);
      fetch(`/api/journal/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasData: migratedPages, pageCount: 1 }),
      }).catch(() => {});
    } else {
      setInkPages([[]]);
    }
    tiptapEditorRef.current = null;
    setTiptapEditorInstance(null);
    setInkTool("pen");
    setInkSize(4);
    setInkCanUndo(false);
    setInkCanRedo(false);
    setAiInsights(null);
    setJournalPrompt(null);
    setMediaItems(entry.media || []);
    const ageMs = Date.now() - new Date(entry.createdAt).getTime();
    const isOld = ageMs > 24 * 60 * 60 * 1000;
    setIsEntryLocked(isOld);
    setIsUnlocked(false);
    setEditorOpen(true);
  }, []);

  const handleDayClick = (date: Date, dayEntries: JournalEntry[]) => {
    setSelectedDate(date);
    setSelectedEntries(dayEntries);
    if (dayEntries.length === 0) {
      handleNewEntry();
    }
  };

  const handleNewEntry = () => {
    const backDate = selectedDateRef.current;
    const backEntries = selectedEntriesRef.current;
    if (isFree && thisMonthEntryCount >= JOURNAL_FREE_LIMIT) {
      setShowJournalUpgrade(true);
      return;
    }
    resetEditor();
    if (backDate) {
      backTargetRef.current = { date: backDate, entries: backEntries };
    }
    const defaultId = getDefaultTemplate();
    if (defaultId) {
      const doc = getTemplateDoc(defaultId);
      setSelectedTemplateId(defaultId);
      setTemplateDoc(doc as Record<string, unknown>);
      setEditorOpen(true);
    } else {
      setTemplatePickerOpen(true);
    }
  };

  const handleTemplateSelect = (template: JournalTemplate) => {
    setTemplatePickerOpen(false);
    const doc = getTemplateDoc(template.id);
    setSelectedTemplateId(template.id);
    setTemplateDoc(doc as Record<string, unknown>);
    if (template.id !== "blank") {
      setEntryTitle(template.name);
    }
    setEditorOpen(true);
  };

  const handleOpenEntryFromMedia = useCallback((entId: string) => {
    const entry = entries.find((e) => e.id === entId);
    if (entry) {
      setSelectedDate(new Date(entry.createdAt));
      setSelectedEntries([entry]);
    }
  }, [entries]);

  const handleMediaChange = useCallback((newMedia: MediaThumb[] | ((prev: MediaThumb[]) => MediaThumb[])) => {
    if (typeof newMedia === "function") {
      setMediaItems(newMedia);
    } else {
      setMediaItems(newMedia);
    }
  }, []);

  const handleAddPhotosClick = useCallback(async () => {
    if (entryId) {
      addPhotosInputRef.current?.click();
      return;
    }
    const hasContent = inputMode === "type" ? textContent.length > 0 : inkPages.some((p) => p.length > 0);
    if (!hasContent) {
      toast({ variant: "destructive", title: "Write something first", description: "Add some text or a drawing before attaching photos." });
      return;
    }
    const newId = await createEntry();
    if (newId) {
      setTimeout(() => addPhotosInputRef.current?.click(), 100);
    }
  }, [entryId, inputMode, textContent, inkPages, toast, createEntry]);

  const handleAddPhotosFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    if (entryId) {
      await photoUpload.uploadFiles(files, entryId);
    }
    e.target.value = "";
  }, [entryId, photoUpload]);

  const handleCalendarAddPhoto = useCallback(async (date: Date, dayEntries: JournalEntry[], files: File[]) => {
    const existingEntryId = dayEntries.length > 0 ? dayEntries[dayEntries.length - 1].id : undefined;
    await photoUpload.createEntryAndUpload(files, date, existingEntryId);
  }, [photoUpload]);

  const handleEntryAddPhotos = useCallback((entId: string) => {
    setEntryPhotoTargetId(entId);
    setTimeout(() => entryPhotoInputRef.current?.click(), 50);
  }, []);

  const handleEntryPhotoFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && entryPhotoTargetId) {
      await photoUpload.uploadFiles(Array.from(e.target.files), entryPhotoTargetId);
    }
    e.target.value = "";
    setEntryPhotoTargetId(null);
  }, [entryPhotoTargetId, photoUpload]);

  const handleDayAddPhotos = useCallback(() => {
    setDayPhotosDialogOpen(true);
    setDayPhotosAttachMode("recent");
    setDayPhotosPickedEntryId(null);
  }, []);

  const handleDayPhotosConfirm = useCallback(() => {
    setDayPhotosDialogOpen(false);
    setTimeout(() => dayPhotosInputRef.current?.click(), 50);
  }, []);

  const handleDayPhotosFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedDate) return;
    const files = Array.from(e.target.files);

    if (dayPhotosAttachMode === "new") {
      await photoUpload.createEntryAndUpload(files, selectedDate);
    } else if (dayPhotosAttachMode === "pick" && dayPhotosPickedEntryId) {
      await photoUpload.uploadFiles(files, dayPhotosPickedEntryId);
    } else if (selectedEntries.length > 0) {
      const mostRecentId = selectedEntries[selectedEntries.length - 1].id;
      await photoUpload.uploadFiles(files, mostRecentId);
    } else {
      await photoUpload.createEntryAndUpload(files, selectedDate);
    }

    e.target.value = "";
    setDayPhotosAttachMode("recent");
    setDayPhotosPickedEntryId(null);
  }, [selectedDate, selectedEntries, dayPhotosAttachMode, dayPhotosPickedEntryId, photoUpload]);

  const editorDate = useMemo(() => {
    if (selectedEntries.length > 0 && selectedEntries[0].createdAt) {
      return new Date(selectedEntries[0].createdAt);
    }
    if (selectedDate) return selectedDate;
    return new Date();
  }, [selectedEntries, selectedDate]);

  const handleTiptapUpdate = useCallback((json: Record<string, unknown>, plainText: string) => {
    setContentRichState(json);
    setTextContent(plainText);
  }, []);

  const handleModeChange = useCallback((newMode: "type" | "write") => {
    setInputMode(newMode);
  }, []);

  const handleEditorReady = useCallback((editor: Editor) => {
    tiptapEditorRef.current = editor;
    setTiptapEditorInstance(editor);
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!entryId) return;
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(entry.title || "Journal Entry", 20, y);
      y += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(new Date(entry.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }), 20, y);
      y += 8;

      if (entry.mood) {
        doc.text(`Mood: ${entry.mood.charAt(0) + entry.mood.slice(1).toLowerCase()}`, 20, y);
        y += 6;
      }

      if (entry.tags && entry.tags.length > 0) {
        doc.text(`Tags: ${entry.tags.join(", ")}`, 20, y);
        y += 6;
      }

      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(20, y, pageWidth - 20, y);
      y += 8;

      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11);
      const content = entry.contentPlainText || entry.content || "";
      if (content) {
        const lines = doc.splitTextToSize(content, pageWidth - 40);
        for (const line of lines) {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 20, y);
          y += 6;
        }
      } else if (entry.canvasData || entry.inkData) {
        doc.setTextColor(120, 120, 120);
        doc.text("[Handwritten entry]", 20, y);
        y += 6;
      }

      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text("Everstead Journal", pageWidth / 2, 290, { align: "center" });

      doc.save(`journal-${entry.title || "entry"}-${new Date(entry.createdAt).toISOString().slice(0, 10)}.pdf`);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to export PDF." });
    }
  }, [entryId, entries, toast]);

  const editorInitialContent = useMemo(() => {
    if (contentRichState) return contentRichState;
    if (selectedEntries.length > 0 && selectedEntries[0].contentRich) {
      return selectedEntries[0].contentRich as Record<string, unknown>;
    }
    if (templateDoc) return templateDoc;
    return null;
  }, [contentRichState, selectedEntries, templateDoc]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (editorOpen) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
          <div className="flex items-center gap-2 px-4 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              aria-label="Go back"
              data-testid="button-back-editor"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <input
              type="text"
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              placeholder="Entry title..."
              className="flex-1 bg-transparent border-none outline-none text-lg font-serif font-medium placeholder:text-muted-foreground/60 min-w-0"
              style={{ fontFamily: "'Georgia', serif" }}
              readOnly={isEntryLocked && !isUnlocked}
              data-testid="input-entry-title"
            />

            <AutosaveIndicator status={autosaveStatus} onRetry={() => { if (entryId) doSave(entryId); else scheduleAutosave(); }} />

            {isEntryLocked && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={isUnlocked ? "text-green-500" : "text-muted-foreground"}
                    title={isUnlocked ? "Entry unlocked for this session" : "Entry locked (older than 24 hours)"}
                    data-testid="button-lock-toggle"
                  >
                    {isUnlocked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="end">
                  <p className="text-sm font-medium mb-2">
                    {isUnlocked ? "Entry is unlocked" : "This entry is locked"}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {isUnlocked
                      ? "You can edit this entry for this session. The lock will reapply when you close the editor."
                      : "Entries older than 24 hours are automatically locked to prevent accidental edits."}
                  </p>
                  {!isUnlocked && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setIsUnlocked(true)}
                      data-testid="button-unlock-entry"
                    >
                      <LockOpen className="h-3.5 w-3.5 mr-1.5" />
                      Unlock for editing
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            )}

            {entryId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleExportPdf}
                title="Export as PDF"
                data-testid="button-export-pdf"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => { if (!(isEntryLocked && !isUnlocked)) setIsPrivate(!isPrivate); }}
              className={`${isPrivate ? "text-amber-500" : ""} ${isEntryLocked && !isUnlocked ? "opacity-60" : ""}`}
              title={isPrivate ? "Private — hidden from shared views and AI" : "Mark as private"}
              disabled={isEntryLocked && !isUnlocked}
              data-testid="button-privacy-toggle"
            >
              {isPrivate ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            </Button>
          </div>

          <p className="px-4 text-sm text-muted-foreground" data-testid="text-entry-date">
            {editorDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>

          <div className="flex items-center gap-1.5 px-4 pb-2 overflow-x-auto">
            {MOOD_OPTIONS.map((mood) => {
              const isSelected = selectedMood === mood.value;
              return (
                <Badge
                  key={mood.value}
                  variant={isSelected ? "outline" : "secondary"}
                  onClick={() => { if (!(isEntryLocked && !isUnlocked)) setSelectedMood(isSelected ? null : mood.value); }}
                  className={`text-xs whitespace-nowrap transition-colors ${isEntryLocked && !isUnlocked ? "opacity-60" : "cursor-pointer"} ${isSelected ? mood.selectedClass : ""}`}
                  data-testid={`mood-${mood.value.toLowerCase()}`}
                >
                  {mood.label}
                </Badge>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
            {entryTags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs gap-1 pr-1 cursor-pointer"
                data-testid={`tag-chip-${tag}`}
              >
                {tag}
                {!(isEntryLocked && !isUnlocked) && (
                  <button
                    onClick={() => setEntryTags((prev) => prev.filter((t) => t !== tag))}
                    className="ml-0.5 hover:text-destructive"
                    data-testid={`tag-remove-${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
            {!(isEntryLocked && !isUnlocked) && (
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                    e.preventDefault();
                    const newTag = tagInput.trim().replace(/,/g, "");
                    if (newTag && !entryTags.includes(newTag)) {
                      setEntryTags((prev) => [...prev, newTag]);
                    }
                    setTagInput("");
                  }
                }}
                onBlur={() => {
                  const newTag = tagInput.trim().replace(/,/g, "");
                  if (newTag && !entryTags.includes(newTag)) {
                    setEntryTags((prev) => [...prev, newTag]);
                  }
                  setTagInput("");
                }}
                placeholder={entryTags.length === 0 ? "Add tags..." : ""}
                className="bg-transparent border-none outline-none text-xs placeholder:text-muted-foreground/50 min-w-[60px] max-w-[120px]"
                data-testid="input-tag"
              />
            )}
          </div>
        </div>

        <input
          ref={addPhotosInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleAddPhotosFiles}
          data-testid="input-add-photos"
        />

        <JournalPaper className="flex-1">
          <JournalAIPromptCard
            prompt={journalPrompt}
            isLoading={isLoadingPrompt}
            onDismiss={() => setJournalPrompt(null)}
          />

          <div style={{ display: inputMode === "type" ? "block" : "none" }}>
            <JournalTiptapEditor
              key={entryId || "new"}
              initialContent={editorInitialContent}
              onUpdate={handleTiptapUpdate}
              onEditorReady={handleEditorReady}
              placeholder="Start writing your thoughts..."
              autoFocus={!(isEntryLocked && !isUnlocked)}
              editable={!(isEntryLocked && !isUnlocked)}
              editorRef={tiptapEditorRef}
            />

            {aiInsights && aiInsights.length > 0 && (
              <div className="mx-[60px] mr-6 mb-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">AI Insights</span>
                </div>
                <ul className="space-y-2">
                  {aiInsights.map((insight, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div style={{ display: inputMode === "write" ? "block" : "none" }}>
            <div className={isEntryLocked && !isUnlocked ? "pointer-events-none opacity-90" : ""}>
              <InkPad
                ref={inkPadRef}
                pages={inkPages}
                onChange={setInkPages}
                onHistoryChange={(canUndo, canRedo) => {
                  setInkCanUndo(canUndo);
                  setInkCanRedo(canRedo);
                }}
                className="w-full"
                color={inkColor}
                size={inkSize}
                isEraser={inkIsEraser}
                templateSections={extractTemplateSections(selectedTemplateId)}
              />
            </div>
          </div>

          {inputMode === "write" && entryId && (
            <div className="px-[60px] pr-6 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const entry = entries?.find((e: JournalEntry) => e.id === entryId);
                    if (entry) handleConvertToText(entryId, entry);
                    else handleConvertToText(entryId, { id: entryId, userId: "", tags: [], isPrivate: false, createdAt: "", updatedAt: "", canvasData: inkPages });
                  }}
                  disabled={isTranscribing}
                  className="gap-1.5"
                  data-testid="button-editor-convert-to-text"
                >
                  {isTranscribing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  {isTranscribing ? "Transcribing..." : "Convert to Text"}
                </Button>
              </div>
              {transcribedText && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Transcribed Text</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{transcribedText}</p>
                </div>
              )}
            </div>
          )}

          {entryId && mediaItems.some((m) => m.mimeType?.startsWith("audio/")) && (
            <div className="px-[60px] pr-6 pb-4 space-y-2">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Voice Recordings</span>
              </div>
              {mediaItems.filter((m) => m.mimeType?.startsWith("audio/")).map((m) => (
                <AudioMediaItem key={m.id} item={m as AudioMediaItemData} entryId={entryId!} />
              ))}
            </div>
          )}

          {entryId && (
            <div className="px-[60px] pr-6 pb-20 space-y-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Photos</span>
              </div>
              <MediaUpload
                entryId={entryId}
                media={mediaItems.filter((m) => !m.mimeType?.startsWith("audio/"))}
                onMediaChange={handleMediaChange}
              />
            </div>
          )}
        </JournalPaper>

        <JournalBottomToolbar
          mode={inputMode}
          onModeChange={handleModeChange}
          editor={tiptapEditorInstance}
          onAddPhoto={handleAddPhotosClick}
          onAIPrompt={() => {
            if (isFree) {
              setShowJournalUpgrade(true);
              return;
            }
            if (isPrivate) {
              toast({ variant: "destructive", title: "Private entry", description: "AI prompts are disabled for private entries." });
              return;
            }
            if (isLoadingPrompt) return;
            handleJournalPrompt();
          }}
          onMic={() => {
            if (isEntryLocked && !isUnlocked) return;
            if (isFree) {
              setShowJournalUpgrade(true);
              return;
            }
            if (voiceMode === "vtt" && inputMode !== "type") {
              toast({ variant: "destructive", title: "Type mode only", description: "Voice to Text is only available in type mode. Switch to Voice Recording for write mode." });
              return;
            }
            if (voiceMode === "vtt" && !tiptapEditorInstance) {
              return;
            }
            toggleRecording();
          }}
          isRecording={isRecording || isVoiceCapturing}
          micDisabled={voiceMode === "vtt" && inputMode === "type" && !tiptapEditorInstance && !isRecording}
          voiceMode={voiceMode}
          onVoiceModeChange={setVoiceMode}
          recordingElapsed={voiceCaptureElapsed}
          photoUploading={photoUpload.isUploading}
          writeToolState={{
            tool: inkTool,
            size: inkSize,
            penColor: inkColor,
            onToolChange: (tool) => {
              setInkTool(tool);
            },
            onSizeChange: setInkSize,
            onPenColorChange: (c) => setInkCustomColor(c),
            onUndo: () => inkPadRef.current?.undo(),
            onRedo: () => inkPadRef.current?.redo(),
            canUndo: inkCanUndo,
            canRedo: inkCanRedo,
          }}
        />
      </div>
    );
  }

  if (selectedDate && selectedEntries.length > 0) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <input
          ref={entryPhotoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleEntryPhotoFiles}
          data-testid="input-entry-photo"
        />
        <input
          ref={dayPhotosInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleDayPhotosFiles}
          data-testid="input-day-photo"
        />

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Button
            variant="ghost"
            onClick={() => { setSelectedDate(null); setSelectedEntries([]); }}
            className="gap-2"
            data-testid="button-back-calendar"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium">
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleDayAddPhotos}
              className="gap-2"
              disabled={photoUpload.isUploading}
              aria-label="Add photos to this day"
              data-testid="day-add-photos"
            >
              {photoUpload.isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              Add photos
            </Button>
            <Button
              variant="outline"
              onClick={handleNewEntry}
              className="gap-2"
              data-testid="button-new-entry"
            >
              <Plus className="h-4 w-4" />
              New Entry
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {selectedEntries.map((entry) => (
            <Card key={entry.id} data-testid={`card-entry-${entry.id}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                    {(entry.title || entry.templateId) && (
                      <span className="text-sm font-medium font-serif" style={{ fontFamily: "'Georgia', serif" }}>
                        {entry.title || getTemplateName(entry.templateId || "") || "Untitled"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.mood && (
                      <Badge variant="secondary" className="text-xs">
                        {entry.mood.charAt(0) + entry.mood.slice(1).toLowerCase()}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleEntryAddPhotos(entry.id); }}
                      className="gap-1.5"
                      aria-label="Add photos to this entry"
                      data-testid="entry-add-photos"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span className="text-xs">Photos</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); openEntryForEdit(entry, true); }}
                      className="gap-1.5"
                      aria-label="Edit this entry"
                      data-testid="button-edit-entry"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      <span className="text-xs">Edit</span>
                    </Button>
                  </div>
                </div>
                {(entry.contentPlainText || entry.content) && (
                  <p className="text-sm leading-relaxed">{entry.contentPlainText || entry.content}</p>
                )}
                {(entry.canvasData || entry.inkData) && !entry.contentPlainText && !entry.content && (
                  <p className="text-sm text-muted-foreground italic">Handwritten entry</p>
                )}
                {(entry.canvasData || entry.inkData) && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); handleConvertToText(entry.id, entry); }}
                      disabled={isTranscribing}
                      className="gap-1.5"
                      data-testid="button-convert-to-text"
                    >
                      {isTranscribing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      {isTranscribing ? "Transcribing..." : "Convert to Text"}
                    </Button>
                    {entry.transcriptionStatus === "pending" && (
                      <span className="text-xs text-amber-500 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Transcribing...
                      </span>
                    )}
                    {entry.transcriptionStatus === "complete" && entry.contentPlainText && (
                      <span className="text-xs text-green-500">Transcribed</span>
                    )}
                  </div>
                )}
                {transcribedText && transcriptionEntryId === entry.id && (
                  <div className="p-3 rounded-lg bg-muted/50 border mt-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Transcribed Text</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{transcribedText}</p>
                  </div>
                )}
                {entry.media && entry.media.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {entry.media.map((m) => (
                      <img
                        key={m.id}
                        src={m.url}
                        alt=""
                        className="w-20 h-20 object-cover rounded-md"
                        loading="lazy"
                        data-testid={`img-entry-media-${m.id}`}
                      />
                    ))}
                  </div>
                )}
                {entry.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {entry.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={dayPhotosDialogOpen} onOpenChange={setDayPhotosDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add photos to day</DialogTitle>
              <DialogDescription>Choose where to attach your photos.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <button
                onClick={() => setDayPhotosAttachMode("recent")}
                className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${dayPhotosAttachMode === "recent" ? "border-primary bg-primary/5" : "border-border"}`}
                data-testid="day-photos-recent"
              >
                <ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Most recent entry</p>
                  <p className="text-xs text-muted-foreground">Attach to the latest entry this day</p>
                </div>
              </button>

              {selectedEntries.length > 1 && (
                <button
                  onClick={() => setDayPhotosAttachMode("pick")}
                  className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${dayPhotosAttachMode === "pick" ? "border-primary bg-primary/5" : "border-border"}`}
                  data-testid="day-photos-pick"
                >
                  <List className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Pick an entry</p>
                    <p className="text-xs text-muted-foreground">Choose which entry to attach to</p>
                  </div>
                </button>
              )}

              {dayPhotosAttachMode === "pick" && (
                <div className="pl-7 space-y-1 max-h-40 overflow-y-auto">
                  {selectedEntries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setDayPhotosPickedEntryId(entry.id)}
                      className={`w-full text-left p-2 rounded-md text-sm transition-colors ${dayPhotosPickedEntryId === entry.id ? "bg-primary/10 border border-primary" : "border border-transparent hover:bg-muted"}`}
                      data-testid={`day-photos-entry-${entry.id}`}
                    >
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      {(entry.contentPlainText || entry.content) && (
                        <p className="line-clamp-1 text-xs">
                          {(entry.contentPlainText || entry.content || "").slice(0, 60)}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setDayPhotosAttachMode("new")}
                className={`w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${dayPhotosAttachMode === "new" ? "border-primary bg-primary/5" : "border-border"}`}
                data-testid="day-photos-new"
              >
                <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Create new entry</p>
                  <p className="text-xs text-muted-foreground">Start a new entry and attach photos</p>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleDayPhotosConfirm}
                disabled={dayPhotosAttachMode === "pick" && !dayPhotosPickedEntryId}
                data-testid="button-day-photos-continue"
              >
                Choose files
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 border-b">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 ${
                viewMode === "list"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
              data-testid="tab-list-view"
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 ${
                viewMode === "calendar"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
              data-testid="tab-calendar-view"
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </button>
            <button
              onClick={() => setViewMode("media")}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 ${
                viewMode === "media"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
              data-testid="tab-media-view"
            >
              <ImageIcon className="h-4 w-4" />
              Media
            </button>
          </div>
        </div>

        {viewMode !== "media" && (
          <div className="flex items-center gap-2">
            {isFree && (
              <span className="text-xs text-muted-foreground" data-testid="text-journal-usage">
                {thisMonthEntryCount} / {JOURNAL_FREE_LIMIT} this month
              </span>
            )}
            <Button
              onClick={handleNewEntry}
              className="gap-2"
              data-testid="button-new-entry"
            >
              <Plus className="h-4 w-4" />
              New Entry
            </Button>
          </div>
        )}
      </div>

      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search your journal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="journal-search-input"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {activeTagFilter && (
              <Badge
                variant="outline"
                className="text-xs cursor-pointer shrink-0"
                onClick={() => setActiveTagFilter(null)}
                data-testid="tag-filter-clear"
              >
                <X className="h-3 w-3 mr-0.5" />
                Clear
              </Badge>
            )}
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={activeTagFilter === tag ? "default" : "outline"}
                className={`text-xs cursor-pointer whitespace-nowrap shrink-0 ${activeTagFilter === tag ? "border-primary bg-primary/10 text-primary" : ""}`}
                onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                data-testid={`tag-filter-${tag}`}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <input
        ref={entryPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleEntryPhotoFiles}
        data-testid="input-entry-photo-list"
      />

      {viewMode === "media" ? (
        <MediaGrid onOpenEntry={handleOpenEntryFromMedia} />
      ) : viewMode === "calendar" ? (
        <JournalCalendar
          entries={filteredEntries}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onDayClick={handleDayClick}
          onAddPhoto={handleCalendarAddPhoto}
        />
      ) : (
        <div className="space-y-3">
          {filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  {debouncedSearch ? "No entries match your search." : "No journal entries yet. Create your first one!"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredEntries.map((entry) => (
              <Card
                key={entry.id}
                className="hover-elevate cursor-pointer"
                onClick={() => openEntryForEdit(entry)}
                data-testid={`card-entry-${entry.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          {(entry.title || entry.templateId) && (
                            <span className="text-sm font-medium font-serif truncate" style={{ fontFamily: "'Georgia', serif" }}>
                              <HighlightText text={entry.title || getTemplateName(entry.templateId || "") || "Untitled"} query={debouncedSearch} />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleEntryAddPhotos(entry.id); }}
                            className="gap-1"
                            aria-label="Add photos to this entry"
                            data-testid="entry-add-photos"
                          >
                            <Camera className="h-3.5 w-3.5" />
                          </Button>
                          {entry.hasMedia && (
                            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {entry.mood && (
                            <Badge variant="secondary" className="text-xs">
                              {entry.mood.charAt(0) + entry.mood.slice(1).toLowerCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {(entry.contentPlainText || entry.content) && (
                        <p className="text-sm leading-relaxed line-clamp-2">
                          <HighlightText text={(entry.contentPlainText || entry.content || "").slice(0, 200)} query={debouncedSearch} />
                        </p>
                      )}
                      {(entry.canvasData || entry.inkData) && !entry.contentPlainText && !entry.content && (
                        <p className="text-sm text-muted-foreground italic">Handwritten entry</p>
                      )}
                      {(entry.canvasData || entry.inkData) && entry.transcriptionStatus === "pending" && (
                        <span className="text-xs text-amber-500 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Transcribing...
                        </span>
                      )}
                      {entry.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {entry.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {entry.media && entry.media.length > 0 && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        {entry.media.slice(0, 2).map((m) => (
                          <img
                            key={m.id}
                            src={m.url}
                            alt=""
                            className="w-14 h-14 object-cover rounded-md"
                            loading="lazy"
                            data-testid={`img-list-thumb-${m.id}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <Dialog open={showJournalUpgrade} onOpenChange={setShowJournalUpgrade}>
        <DialogContent className="max-w-sm" data-testid="dialog-journal-upgrade">
          <UpgradePrompt
            feature="AI Journal Prompts"
            description="Personalized writing prompts, unlimited entries, and AI insights are Pro features. Upgrade to unlock your full journaling experience."
          />
        </DialogContent>
      </Dialog>

      <TemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
}

interface AudioMediaItemData {
  id: string;
  url: string;
  mimeType: string;
  durationS?: number | null;
  storagePath: string;
}

function AudioMediaItem({ item, entryId }: { item: AudioMediaItemData; entryId: string }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [transcriptionText, setTranscriptionText] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (item.url) {
      setAudioUrl(item.url);
    }
  }, [item.url]);

  const handleTranscribe = async () => {
    setIsTranscribingAudio(true);
    try {
      const res = await fetch(`/api/journal/${entryId}/audio-transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: item.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Transcription failed");
      }
      const data = await res.json();
      setTranscriptionText(data.text);
      queryClient.invalidateQueries({ queryKey: ["journal", "list"] });
      queryClient.invalidateQueries({ queryKey: ["journal", "entry", entryId] });
      toast({ title: "Transcription complete" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transcription failed";
      toast({ variant: "destructive", title: "Transcription failed", description: msg });
    } finally {
      setIsTranscribingAudio(false);
    }
  };

  const durationLabel = item.durationS
    ? `${Math.floor(item.durationS / 60)}:${(item.durationS % 60).toString().padStart(2, "0")}`
    : null;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2" data-testid={`audio-media-${item.id}`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Mic className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {durationLabel && (
            <span className="text-xs text-muted-foreground font-mono">{durationLabel}</span>
          )}
          {audioUrl && (
            <audio
              controls
              src={audioUrl}
              className="h-8 flex-1 min-w-0"
              data-testid={`audio-player-${item.id}`}
            />
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTranscribe}
          disabled={isTranscribingAudio}
          className="flex-shrink-0 text-xs gap-1"
          data-testid={`btn-transcribe-${item.id}`}
        >
          {isTranscribingAudio ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          Transcribe
        </Button>
      </div>
      {transcriptionText && (
        <div className="p-2 rounded bg-muted/50 text-sm whitespace-pre-wrap" data-testid={`transcription-text-${item.id}`}>
          {transcriptionText}
        </div>
      )}
    </div>
  );
}
