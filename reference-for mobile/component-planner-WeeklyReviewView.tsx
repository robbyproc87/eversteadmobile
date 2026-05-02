"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAutosave } from "@/hooks/useAutosave";
import { formatDateParam } from "@/lib/planner-utils";
import { ColoredSectionHeader } from "./ColoredSectionHeader";
import { NumberedInputGroup } from "./NumberedInputGroup";
import WeeklyScoreSelector from "./WeeklyScoreSelector";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Briefcase, Heart, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WeeklyReviewViewProps {
  weekStart: Date;
}

interface WeekData {
  id: string;
  weekScore: number | null;
  weeklyReviewInsights: string | null;
}

export default function WeeklyReviewView({ weekStart }: WeeklyReviewViewProps) {
  const queryClient = useQueryClient();
  const weekStartStr = formatDateParam(weekStart);

  const [weekScore, setWeekScore] = useState<number | null>(null);
  const [insights, setInsights] = useState("");
  const [personalTEs, setPersonalTEs] = useState<string[]>(["", "", ""]);
  const [professionalTEs, setProfessionalTEs] = useState<string[]>(["", "", ""]);
  const [innerTEs, setInnerTEs] = useState<string[]>(["", "", ""]);
  const [initialized, setInitialized] = useState(false);
  const [innerFocused, setInnerFocused] = useState(false);

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
    setWeekScore(weekData.weekScore);
    setInsights(weekData.weeklyReviewInsights ?? "");
    setInitialized(true);
  }, [weekData]);

  const scoreAndInsightsData = useMemo(() => {
    if (!weekData?.id) return null;
    return { id: weekData.id, weekScore, weeklyReviewInsights: insights };
  }, [weekScore, insights, weekData?.id]);

  const saveScoreAndInsights = useCallback(
    async (payload: typeof scoreAndInsightsData) => {
      if (!payload) return;
      const res = await fetch("/api/planner/week", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save review");
    },
    []
  );

  const { status: reviewStatus } = useAutosave({
    data: scoreAndInsightsData,
    onSave: saveScoreAndInsights as (data: typeof scoreAndInsightsData) => Promise<void>,
    debounceMs: 1500,
    enabled: initialized && !!scoreAndInsightsData,
  });

  useEffect(() => {
    if (reviewStatus === "saved") {
      queryClient.invalidateQueries({ queryKey: ["stats", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["activity", "recent"] });
    }
  }, [reviewStatus, queryClient]);

  const nextWeekTEData = useMemo(() => {
    if (!weekData?.id) return null;
    const items: { category: string; ordinal: number; text: string }[] = [];
    personalTEs.forEach((text, i) => items.push({ category: "personal", ordinal: i, text }));
    professionalTEs.forEach((text, i) => items.push({ category: "professional", ordinal: i, text }));
    innerTEs.forEach((text, i) => items.push({ category: "inner", ordinal: i, text }));
    return { currentWeekId: weekData.id, items };
  }, [personalTEs, professionalTEs, innerTEs, weekData?.id]);

  const saveNextWeekTEs = useCallback(
    async (payload: typeof nextWeekTEData) => {
      if (!payload) return;
      const res = await fetch("/api/planner/week/review/set-next-week", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save next week TEs");

      const nextWeekStart = new Date(weekStart);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      const nextStr = formatDateParam(nextWeekStart);
      queryClient.invalidateQueries({ queryKey: ["planner", "week", nextStr] });
    },
    [weekStart, queryClient]
  );

  const { status: teStatus } = useAutosave({
    data: nextWeekTEData,
    onSave: saveNextWeekTEs as (data: typeof nextWeekTEData) => Promise<void>,
    debounceMs: 1500,
    enabled: initialized && !!nextWeekTEData,
  });

  const overallStatus = useMemo(() => {
    if (reviewStatus === "error" || teStatus === "error") return "error";
    if (reviewStatus === "saving" || teStatus === "saving") return "saving";
    if (reviewStatus === "saved" || teStatus === "saved") return "saved";
    return "idle";
  }, [reviewStatus, teStatus]);

  const handlePersonalChange = useCallback((index: number, value: string) => {
    setPersonalTEs((prev) => { const n = [...prev]; n[index] = value; return n; });
  }, []);

  const handleProfessionalChange = useCallback((index: number, value: string) => {
    setProfessionalTEs((prev) => { const n = [...prev]; n[index] = value; return n; });
  }, []);

  const handleInnerChange = useCallback((index: number, value: string) => {
    setInnerTEs((prev) => { const n = [...prev]; n[index] = value; return n; });
    if (!innerFocused) setInnerFocused(true);
  }, [innerFocused]);

  const innerHasContent = useMemo(() => innerTEs.some((t) => t.length > 0), [innerTEs]);

  const insightsRef = useRef<HTMLTextAreaElement | null>(null);

  const autoResize = useCallback((el: HTMLTextAreaElement | null, minH = 200) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, minH)}px`;
  }, []);

  useEffect(() => {
    autoResize(insightsRef.current, 200);
  }, [insights, autoResize]);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="weekly-review-skeleton">
        <div className="flex flex-col lg:flex-row gap-6">
          <Skeleton className="h-96 w-full lg:w-1/2" />
          <Skeleton className="h-96 w-full lg:w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="weekly-review-view">
      <div className="flex items-center justify-end min-h-[20px]">
        {overallStatus === "saving" && <span className="text-xs text-muted-foreground" data-testid="autosave-saving">Saving...</span>}
        {overallStatus === "saved" && <span className="text-xs text-green-500" data-testid="autosave-saved">Saved</span>}
        {overallStatus === "error" && <span className="text-xs text-red-500" data-testid="autosave-error">Save failed</span>}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/2 space-y-6" data-testid="column-reflect">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Reflect on Your Week
          </h3>

          <div className="space-y-3">
            <span className="text-sm font-medium">Weekly Score</span>
            <WeeklyScoreSelector value={weekScore} onChange={setWeekScore} />
          </div>

          <div className="space-y-3">
            <span className="text-sm font-medium">Insights & Notes</span>
            <textarea
              ref={insightsRef}
              value={insights}
              onChange={(e) => setInsights(e.target.value)}
              placeholder="What worked this week? What didn't? What will you do differently?"
              className="planner-lined-paper w-full bg-transparent text-sm resize-none min-h-[200px]"
              data-testid="review-insights-textarea"
            />
          </div>
        </div>

        <div className="w-full lg:w-1/2 space-y-6" data-testid="column-set-direction">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Set Next Week's Direction
          </h3>

          <div className="pl-4 border-l-2 border-primary/30">
            <p className="text-sm italic text-muted-foreground">
              "What 3 things must happen over the next 7 days for me to feel this week was very successful?"
            </p>
          </div>

          <div className="space-y-3">
            <ColoredSectionHeader title="Personal" color="blue" icon={<Star className="h-4 w-4" />} />
            <NumberedInputGroup
              count={3}
              values={personalTEs}
              onChange={handlePersonalChange}
              placeholder="Set a personal goal for next week"
              testIdPrefix="review-te-personal"
            />
          </div>

          <div className="space-y-3">
            <ColoredSectionHeader title="Professional" color="amber" icon={<Briefcase className="h-4 w-4" />} />
            <NumberedInputGroup
              count={3}
              values={professionalTEs}
              onChange={handleProfessionalChange}
              placeholder="Set a professional goal for next week"
              testIdPrefix="review-te-professional"
            />
          </div>

          <div
            className={cn("space-y-3 transition-opacity", innerHasContent || innerFocused ? "opacity-100" : "opacity-80")}
            data-testid="review-inner-section"
          >
            <div className="flex items-center gap-2">
              <ColoredSectionHeader title="Inner" color="purple" icon={<Heart className="h-4 w-4" />} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">Your emotional, spiritual, and personal growth — Sharma's Heartset & Soulset</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <NumberedInputGroup
              count={3}
              values={innerTEs}
              onChange={handleInnerChange}
              placeholder="e.g., Daily stillness, Journaling, Gratitude practice"
              testIdPrefix="review-te-inner"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
