"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAutosave } from "@/hooks/useAutosave";
import { formatDateParam, getWeekDates, getDayName } from "@/lib/planner-utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WeeklyStoryViewProps {
  weekStart: Date;
}

interface WeekData {
  id: string;
  weeklyStoryDays: Array<{
    id: string;
    dayOfWeek: number;
    narrative: string | null;
    aiSuggested: boolean;
  }>;
  weeklyStoryObservation: {
    id: string;
    content: string | null;
  } | null;
}

export default function WeeklyStoryView({ weekStart }: WeeklyStoryViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const weekStartStr = formatDateParam(weekStart);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const [narratives, setNarratives] = useState<string[]>(Array(7).fill(""));
  const [observation, setObservation] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [suggestingDay, setSuggestingDay] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<boolean[]>(Array(7).fill(false));
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const obsTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const autoResize = useCallback((el: HTMLTextAreaElement | null, minH = 120) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, minH)}px`;
  }, []);

  useEffect(() => {
    textareaRefs.current.forEach((el) => autoResize(el, 120));
    autoResize(obsTextareaRef.current, 200);
  }, [narratives, observation, autoResize]);

  const toggleCollapse = useCallback((dayIndex: number) => {
    setCollapsed((prev) => {
      const next = [...prev];
      next[dayIndex] = !next[dayIndex];
      return next;
    });
  }, []);

  const { data: weekData, isLoading } = useQuery<WeekData>({
    queryKey: ["planner", "week", weekStartStr],
    queryFn: async () => {
      const res = await fetch(`/api/planner/week?weekStart=${weekStartStr}`);
      if (!res.ok) throw new Error("Failed to fetch week data");
      return res.json();
    },
  });

  useEffect(() => {
    if (!weekData) return;
    const narr = Array(7).fill("");
    (weekData.weeklyStoryDays || []).forEach((d) => {
      if (d.dayOfWeek >= 0 && d.dayOfWeek < 7) {
        narr[d.dayOfWeek] = d.narrative ?? "";
      }
    });
    setNarratives(narr);
    setObservation(weekData.weeklyStoryObservation?.content ?? "");
    setInitialized(true);
  }, [weekData]);

  const storyData = useMemo(() => {
    if (!weekData?.id) return null;
    return {
      weekId: weekData.id,
      days: narratives.map((narrative, i) => ({
        dayOfWeek: i,
        narrative,
      })),
    };
  }, [narratives, weekData?.id]);

  const saveStories = useCallback(
    async (payload: typeof storyData) => {
      if (!payload) return;
      const res = await fetch("/api/planner/week/story", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save stories");
    },
    []
  );

  const obsData = useMemo(() => {
    if (!weekData?.id) return null;
    return { weekId: weekData.id, content: observation };
  }, [observation, weekData?.id]);

  const saveObservation = useCallback(
    async (payload: typeof obsData) => {
      if (!payload) return;
      const res = await fetch("/api/planner/week/story/observation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save observation");
    },
    []
  );

  const { status: storyStatus } = useAutosave({
    data: storyData,
    onSave: saveStories as (data: typeof storyData) => Promise<void>,
    debounceMs: 1500,
    enabled: initialized && !!storyData,
  });

  const { status: obsStatus } = useAutosave({
    data: obsData,
    onSave: saveObservation as (data: typeof obsData) => Promise<void>,
    debounceMs: 1500,
    enabled: initialized && !!obsData,
  });

  const overallStatus = useMemo(() => {
    if (storyStatus === "error" || obsStatus === "error") return "error";
    if (storyStatus === "saving" || obsStatus === "saving") return "saving";
    if (storyStatus === "saved" || obsStatus === "saved") return "saved";
    return "idle";
  }, [storyStatus, obsStatus]);

  const handleNarrativeChange = useCallback((dayIndex: number, value: string) => {
    setNarratives((prev) => {
      const next = [...prev];
      next[dayIndex] = value;
      return next;
    });
  }, []);

  const handleAiSuggest = useCallback(
    async (dayIndex: number) => {
      if (!weekData?.id) return;
      const dateStr = formatDateParam(weekDates[dayIndex]);
      setSuggestingDay(dayIndex);

      try {
        const res = await fetch("/api/coach/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "weekly-story-day",
            context: { date: dateStr },
          }),
        });
        if (!res.ok) throw new Error("Failed to get suggestion");
        const data = await res.json();

        if (!data.suggestion) {
          toast({
            title: "No data found",
            description: data.message || "No journal or planner data found for this day. Write your own story!",
          });
        } else {
          setNarratives((prev) => {
            const next = [...prev];
            next[dayIndex] = data.suggestion;
            return next;
          });
        }
      } catch {
        toast({
          title: "Error",
          description: "Failed to generate suggestion. Please try again.",
          variant: "destructive",
        });
      } finally {
        setSuggestingDay(null);
      }
    },
    [weekData?.id, weekDates, toast]
  );

  const formatDayLabel = (dayIndex: number) => {
    const date = weekDates[dayIndex];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${getDayName(dayIndex)}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="weekly-story-skeleton">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-md" />
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="weekly-story-view">
      <div className="flex items-center justify-end min-h-[20px]">
        {overallStatus === "saving" && (
          <span className="text-xs text-muted-foreground" data-testid="autosave-saving">Saving...</span>
        )}
        {overallStatus === "saved" && (
          <span className="text-xs text-green-500" data-testid="autosave-saved">Saved</span>
        )}
        {overallStatus === "error" && (
          <span className="text-xs text-red-500" data-testid="autosave-error">Save failed</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {weekDates.map((_, dayIndex) => {
          const isCollapsed = collapsed[dayIndex];
          const hasContent = narratives[dayIndex].length > 0;
          const preview = hasContent ? narratives[dayIndex].slice(0, 80) + (narratives[dayIndex].length > 80 ? "..." : "") : "";

          return (
            <Card key={dayIndex} className="p-4 space-y-2 relative group" data-testid={`story-card-${dayIndex}`}>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleCollapse(dayIndex)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover-elevate rounded-md px-1 py-0.5 -ml-1"
                  data-testid={`story-toggle-${dayIndex}`}
                >
                  {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                  {formatDayLabel(dayIndex)}
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleAiSuggest(dayIndex)}
                  disabled={suggestingDay === dayIndex}
                  className="shrink-0"
                  data-testid={`story-ai-suggest-${dayIndex}`}
                >
                  <Sparkles className={`h-3.5 w-3.5 ${suggestingDay === dayIndex ? "animate-pulse" : ""}`} />
                </Button>
              </div>
              {isCollapsed ? (
                hasContent ? (
                  <p
                    className="text-xs text-muted-foreground truncate cursor-pointer"
                    onClick={() => toggleCollapse(dayIndex)}
                    data-testid={`story-preview-${dayIndex}`}
                  >
                    {preview}
                  </p>
                ) : null
              ) : (
                <textarea
                  ref={(el) => { textareaRefs.current[dayIndex] = el; }}
                  value={narratives[dayIndex]}
                  onChange={(e) => handleNarrativeChange(dayIndex, e.target.value)}
                  placeholder="How did you live this day?"
                  className="planner-lined-paper w-full bg-transparent text-sm resize-none min-h-[120px]"
                  data-testid={`story-textarea-${dayIndex}`}
                />
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-4 space-y-2" data-testid="story-observation-card">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Observations</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">What patterns did you notice? What surprised you? What would you do differently?</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <textarea
          ref={obsTextareaRef}
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          placeholder="What patterns did you notice this week? What surprised you? What would you do differently?"
          className="planner-lined-paper w-full bg-transparent text-sm resize-none min-h-[200px]"
          data-testid="story-observation-textarea"
        />
      </Card>
    </div>
  );
}
