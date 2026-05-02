"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  getWeekStart,
  formatDayHeader,
  formatWeekRange,
  formatDateParam,
  parseDateParam,
  getWeekDates,
} from "@/lib/planner-utils";
import DailyPlannerView from "./DailyPlannerView";
import BlueprintView from "./BlueprintView";
import WeeklyStoryView from "./WeeklyStoryView";
import PastWeekExceptionalsView from "./PastWeekExceptionalsView";
import WeeklyReviewView from "./WeeklyReviewView";
import WeeklyReflectionPlaceholder from "./WeeklyReflectionPlaceholder";
import WeeklyFlowIndicator from "./WeeklyFlowIndicator";
import { LifeArchitectureView } from "@/components/life-architecture/LifeArchitectureView";

const weekTabs = [
  { id: "blueprint", label: "Blueprint", reflectionTab: false },
  { id: "story", label: "Weekly Story", reflectionTab: true },
  { id: "past-te", label: "Past Week Exceptionals", reflectionTab: true },
  { id: "review", label: "Weekly Review", reflectionTab: true },
];

interface WeekData {
  id: string;
  weekScore: number | null;
  weeklyStoryDays: Array<{ dayOfWeek: number; narrative: string | null }>;
  trulyExceptionals: Array<{ status: string | null; source: string }>;
}

interface PrevWeekData {
  id: string;
  trulyExceptionals: Array<{ status: string | null; source: string }>;
}

function PlannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const viewParam = searchParams.get("view") || "day";
  const dateParam = searchParams.get("date");
  const tabParam = searchParams.get("tab") || "blueprint";

  const [view, setView] = useState<"day" | "week" | "year">(
    viewParam === "week" ? "week" : viewParam === "year" ? "year" : "day"
  );
  const [laVisited, setLaVisited] = useState(true);
  const [earlyUnlock, setEarlyUnlock] = useState(false);

  const selectedDate = useMemo(() => {
    if (dateParam) return parseDateParam(dateParam);
    return new Date();
  }, [dateParam]);

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekStartStr = formatDateParam(weekStart);

  useEffect(() => {
    const key = `planner_early_unlock_${weekStartStr}`;
    if (typeof window !== "undefined") {
      setEarlyUnlock(localStorage.getItem(key) === "true");
    }
  }, [weekStartStr]);

  const today = new Date();
  const dayOfWeek = today.getDay();
  const isReflectionTime = dayOfWeek === 0 || dayOfWeek === 6;
  const showFullWeeklyViews = isReflectionTime || earlyUnlock;

  const handleEarlyUnlock = useCallback(() => {
    const key = `planner_early_unlock_${weekStartStr}`;
    localStorage.setItem(key, "true");
    setEarlyUnlock(true);
  }, [weekStartStr]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLaVisited(localStorage.getItem("everstead-la-visited") === "true");
    }
  }, []);

  const updateParams = (newView: "day" | "week" | "year", newDate: Date, newTab?: string) => {
    const params = new URLSearchParams();
    params.set("view", newView);
    if (newView !== "year") {
      params.set("date", formatDateParam(newDate));
    }
    if (newView === "week" && newTab) params.set("tab", newTab);
    router.push(`/planner?${params.toString()}`, { scroll: false });
  };

  const handleViewChange = (newView: "day" | "week" | "year") => {
    setView(newView);
    if (newView === "year") {
      if (!laVisited) {
        setLaVisited(true);
      }
      updateParams("year", selectedDate);
      return;
    }
    const d = newView === "week" ? weekStart : selectedDate;
    updateParams(newView, d, newView === "week" ? tabParam : undefined);
  };

  const handlePrev = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - (view === "week" ? 7 : 1));
    updateParams(view, d, view === "week" ? tabParam : undefined);
  };

  const handleNext = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + (view === "week" ? 7 : 1));
    updateParams(view, d, view === "week" ? tabParam : undefined);
  };

  const handleTabChange = (tab: string) => {
    updateParams("week", weekStart, tab);
  };

  const handleDayClick = (date: Date) => {
    setView("day");
    updateParams("day", date);
  };

  const dateLabel = view === "year" ? "" : view === "day" ? formatDayHeader(selectedDate) : formatWeekRange(weekStart);

  const isReflectionTab = weekTabs.find((t) => t.id === tabParam)?.reflectionTab ?? false;
  const showPlaceholder = view === "week" && isReflectionTab && !showFullWeeklyViews;

  const { data: weekData } = useQuery<WeekData>({
    queryKey: ["planner", "week", weekStartStr],
    queryFn: async () => {
      const res = await fetch(`/api/planner/week?weekStart=${weekStartStr}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: view === "week" && showFullWeeklyViews,
  });

  const prevWeekStart = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    return d;
  }, [weekStart]);
  const prevWeekStartStr = formatDateParam(prevWeekStart);

  const { data: prevWeekData } = useQuery<PrevWeekData>({
    queryKey: ["planner", "week", prevWeekStartStr],
    queryFn: async () => {
      const res = await fetch(`/api/planner/week?weekStart=${prevWeekStartStr}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: view === "week" && showFullWeeklyViews,
  });

  const flowSteps = useMemo(() => {
    const storyDays = weekData?.weeklyStoryDays || [];
    const filledNarratives = storyDays.filter((d) => d.narrative && d.narrative.length > 0);
    const storyComplete = filledNarratives.length >= 3;

    const prevReviewSetTEs = (prevWeekData?.trulyExceptionals || []).filter((te) => te.source === "review_set");
    const pastTeComplete = prevReviewSetTEs.some((te) => te.status !== null);

    const reviewComplete = weekData?.weekScore !== null && weekData?.weekScore !== undefined;

    return [
      { id: "story", label: "Weekly Story", completed: storyComplete },
      { id: "past-te", label: "Past Week", completed: pastTeComplete },
      { id: "review", label: "Review", completed: reviewComplete },
    ];
  }, [weekData, prevWeekData]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b gap-2 flex-wrap sticky top-0 z-[100] bg-background">
        {view !== "year" ? (
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={handlePrev}
              data-testid="button-planner-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center" data-testid="text-planner-date">
              {dateLabel}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleNext}
              data-testid="button-planner-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            size="sm"
            variant={view === "day" ? "default" : "ghost"}
            onClick={() => handleViewChange("day")}
            data-testid="button-view-day"
          >
            Day
          </Button>
          <Button
            size="sm"
            variant={view === "week" ? "default" : "ghost"}
            onClick={() => handleViewChange("week")}
            data-testid="button-view-week"
          >
            Week
          </Button>
          <Button
            size="sm"
            variant={view === "year" ? "default" : "ghost"}
            onClick={() => handleViewChange("year")}
            className="relative"
            data-testid="button-view-year"
          >
            Year
            {!laVisited && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
            )}
          </Button>
        </div>
      </div>

      {view === "week" && (
        <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto">
          {weekTabs.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={tabParam === t.id ? "default" : "ghost"}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                "whitespace-nowrap gap-1.5",
                t.reflectionTab && !showFullWeeklyViews && "opacity-85"
              )}
              data-testid={`tab-${t.id}`}
            >
              {t.reflectionTab && !showFullWeeklyViews && (
                <Clock className="h-3 w-3" />
              )}
              {t.label}
            </Button>
          ))}
        </div>
      )}

      {view === "week" && showFullWeeklyViews && isReflectionTab && (
        <WeeklyFlowIndicator steps={flowSteps} activeStepId={tabParam} />
      )}

      <div className="flex-1 overflow-auto p-4">
        {view === "year" ? (
          <LifeArchitectureView />
        ) : view === "day" ? (
          <DailyPlannerView date={selectedDate} />
        ) : (
          <>
            {tabParam === "blueprint" && (
              <BlueprintView weekStart={weekStart} onDayClick={handleDayClick} />
            )}
            {tabParam === "story" && (
              showPlaceholder ? (
                <WeeklyReflectionPlaceholder onUnlock={handleEarlyUnlock} />
              ) : (
                <WeeklyStoryView weekStart={weekStart} />
              )
            )}
            {tabParam === "past-te" && (
              showPlaceholder ? (
                <WeeklyReflectionPlaceholder onUnlock={handleEarlyUnlock} />
              ) : (
                <PastWeekExceptionalsView
                  weekStart={weekStart}
                  onGoToReview={() => handleTabChange("review")}
                />
              )
            )}
            {tabParam === "review" && (
              showPlaceholder ? (
                <WeeklyReflectionPlaceholder onUnlock={handleEarlyUnlock} />
              ) : (
                <WeeklyReviewView weekStart={weekStart} />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function PlannerShell() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-96 w-full" /></div>}>
      <PlannerContent />
    </Suspense>
  );
}
