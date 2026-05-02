"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAutosave } from "@/hooks/useAutosave";
import { formatDateParam } from "@/lib/planner-utils";
import { ColoredSectionHeader, type ColorVariant } from "./ColoredSectionHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Briefcase, Heart, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PastWeekExceptionalsViewProps {
  weekStart: Date;
  onGoToReview: () => void;
}

interface TrulyExceptionalItem {
  id: string;
  category: string;
  ordinal: number;
  text: string | null;
  source: string;
  status: string | null;
  importance: string | null;
}

interface WeekData {
  id: string;
  trulyExceptionals: TrulyExceptionalItem[];
}

const categories: { key: string; label: string; color: ColorVariant; icon: React.ReactNode; tooltip?: string; placeholder?: string; importancePlaceholder?: string }[] = [
  {
    key: "personal",
    label: "Personal",
    color: "blue",
    icon: <Star className="h-4 w-4" />,
  },
  {
    key: "professional",
    label: "Professional",
    color: "amber",
    icon: <Briefcase className="h-4 w-4" />,
  },
  {
    key: "inner",
    label: "Inner",
    color: "purple",
    icon: <Heart className="h-4 w-4" />,
    tooltip: "Your emotional, spiritual, and personal growth — Sharma's Heartset & Soulset",
    placeholder: "e.g., Meditated 4 mornings this week, Forgave myself for missing a deadline, Read 30 pages of a book that stretched my thinking",
    importancePlaceholder: "e.g., It helped me stay centered during a stressful week at work",
  },
];

const statusOptions = [
  { value: "achieved", label: "Achieved", className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" },
  { value: "in_progress", label: "In Progress", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  { value: "missed", label: "Missed", className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
];

export default function PastWeekExceptionalsView({ weekStart }: PastWeekExceptionalsViewProps) {
  const prevWeekStart = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    return d;
  }, [weekStart]);
  const prevWeekStartStr = formatDateParam(prevWeekStart);

  const [teItems, setTeItems] = useState<Record<string, { text: string; importance: string; status: string | null }>>({});
  const [initialized, setInitialized] = useState(false);

  const { data: prevWeekData, isLoading } = useQuery<WeekData>({
    queryKey: ["planner", "week", prevWeekStartStr],
    queryFn: async () => {
      const res = await fetch(`/api/planner/week?weekStart=${prevWeekStartStr}`);
      if (!res.ok) throw new Error("Failed to fetch previous week");
      return res.json();
    },
  });

  const reviewSetTEs = useMemo(() => {
    if (!prevWeekData) return [];
    return (prevWeekData.trulyExceptionals || []).filter((te) => te.source === "review_set");
  }, [prevWeekData]);

  const hasReviewSetTEs = reviewSetTEs.length > 0;

  useEffect(() => {
    if (!prevWeekData) return;
    const items: Record<string, { text: string; importance: string; status: string | null }> = {};
    reviewSetTEs.forEach((te) => {
      items[`${te.category}-${te.ordinal}`] = {
        text: te.text ?? "",
        importance: te.importance ?? "",
        status: te.status,
      };
    });
    categories.forEach((cat) => {
      for (let i = 0; i < 3; i++) {
        const key = `${cat.key}-${i}`;
        if (!items[key]) {
          items[key] = { text: "", importance: "", status: null };
        }
      }
    });
    setTeItems(items);
    setInitialized(true);
  }, [prevWeekData, reviewSetTEs]);

  const saveData = useMemo(() => {
    if (!prevWeekData?.id || !initialized) return null;
    const items = Object.entries(teItems).map(([key, val]) => {
      const [category, ordStr] = key.split("-");
      return {
        category,
        ordinal: parseInt(ordStr, 10),
        text: val.text,
        importance: val.importance,
        status: val.status,
        source: "review_set",
      };
    });
    return { weekId: prevWeekData.id, items };
  }, [teItems, prevWeekData?.id, initialized]);

  const saveTEs = useCallback(
    async (payload: typeof saveData) => {
      if (!payload) return;
      const res = await fetch("/api/planner/week/truly-exceptionals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save TEs");
    },
    []
  );

  const { status } = useAutosave({
    data: saveData,
    onSave: saveTEs as (data: typeof saveData) => Promise<void>,
    debounceMs: 1500,
    enabled: initialized && !!saveData && hasReviewSetTEs,
  });

  const handleImportanceChange = useCallback((category: string, ordinal: number, value: string) => {
    const key = `${category}-${ordinal}`;
    setTeItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], importance: value },
    }));
  }, []);

  const handleTextChange = useCallback((category: string, ordinal: number, value: string) => {
    const key = `${category}-${ordinal}`;
    setTeItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], text: value },
    }));
  }, []);

  const handleStatusChange = useCallback((category: string, ordinal: number, newStatus: string) => {
    const key = `${category}-${ordinal}`;
    setTeItems((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        status: prev[key]?.status === newStatus ? null : newStatus,
      },
    }));
  }, []);

  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const autoResize = useCallback((el: HTMLTextAreaElement | null, minH = 120) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, minH)}px`;
  }, []);

  useEffect(() => {
    textareaRefs.current.forEach((el) => autoResize(el, 120));
  }, [teItems, autoResize]);

  const setTextareaRef = useCallback((key: string, el: HTMLTextAreaElement | null) => {
    if (el) {
      textareaRefs.current.set(key, el);
    } else {
      textareaRefs.current.delete(key);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="past-te-skeleton">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!hasReviewSetTEs) {
    return (
      <div className="flex items-center justify-center py-12 px-4" data-testid="past-te-empty">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <p className="text-muted-foreground">
            You&apos;re just getting started! This tab will show last week&apos;s goals once you&apos;ve completed your first full week. Focus on your Blueprint for now.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="past-week-exceptionals-view">
      <div className="flex items-center justify-end min-h-[20px]">
        {status === "saving" && <span className="text-xs text-muted-foreground" data-testid="autosave-saving">Saving...</span>}
        {status === "saved" && <span className="text-xs text-green-500" data-testid="autosave-saved">Saved</span>}
        {status === "error" && <span className="text-xs text-red-500" data-testid="autosave-error">Save failed</span>}
      </div>

      {categories.map((cat) => (
        <div key={cat.key} className="space-y-3" data-testid={`past-te-category-${cat.key}`}>
          <div className="flex items-center gap-2">
            <ColoredSectionHeader title={cat.label} color={cat.color} icon={cat.icon} />
            {cat.tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{cat.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {Array.from({ length: 3 }, (_, ordinal) => {
            const key = `${cat.key}-${ordinal}`;
            const item = teItems[key] || { text: "", importance: "", status: null };

            return (
              <Card key={ordinal} className="p-4 space-y-3" data-testid={`past-te-row-${cat.key}-${ordinal}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">The Truly Exceptional Thing</span>
                    <textarea
                      ref={(el) => { setTextareaRef(`text-${key}`, el); }}
                      value={item.text}
                      onChange={(e) => handleTextChange(cat.key, ordinal, e.target.value)}
                      placeholder={cat.placeholder || "Not set"}
                      className="planner-lined-paper w-full bg-transparent text-sm resize-none min-h-[120px]"
                      data-testid={`past-te-text-${cat.key}-${ordinal}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Why Was It Important to You</span>
                    <textarea
                      ref={(el) => { setTextareaRef(`imp-${key}`, el); }}
                      value={item.importance}
                      onChange={(e) => handleImportanceChange(cat.key, ordinal, e.target.value)}
                      placeholder={cat.importancePlaceholder || "Reflect on why this mattered..."}
                      className="planner-lined-paper w-full bg-transparent text-sm resize-none min-h-[120px]"
                      data-testid={`past-te-importance-${cat.key}-${ordinal}`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusChange(cat.key, ordinal, opt.value)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-md border transition-colors",
                        item.status === opt.value
                          ? opt.className
                          : "border-border/50 text-muted-foreground hover-elevate"
                      )}
                      data-testid={`past-te-status-${cat.key}-${ordinal}-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
