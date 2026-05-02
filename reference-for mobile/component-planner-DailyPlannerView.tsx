"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAutosave } from "@/hooks/useAutosave";
import { ColoredSectionHeader } from "./ColoredSectionHeader";
import { NumberedInputGroup } from "./NumberedInputGroup";
import { TodoList, TodoItem } from "./TodoList";
import { formatDateParam, formatTime, isToday, getWeekStart } from "@/lib/planner-utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Calendar, CheckSquare, Target, ThumbsUp, Plus, X, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarEventBlocks, AllDayEvents } from "./CalendarEventBlock";
import { CalendarEventDialog } from "./CalendarEventDialog";

interface DailyPlannerViewProps {
  date: Date;
}

interface DailyPlanData {
  id: string;
  dailyGoal: string | null;
  todos: Array<{
    id: string;
    text: string;
    completed: boolean;
    ordinal: number;
    source: string;
  }>;
  priorities: Array<{
    id: string;
    ordinal: number;
    text: string | null;
  }>;
  wentWells: Array<{
    id: string;
    ordinal: number;
    text: string | null;
  }>;
  gratitudes: Array<{
    id: string;
    ordinal: number;
    text: string | null;
  }>;
}

interface BlueprintTodoItem {
  id: string;
  text: string;
  completed: boolean;
  ordinal: number;
  source: string;
}

const SCHEDULE_START_HOUR = 5;
const SCHEDULE_END_HOUR = 22;
const ROW_HEIGHT = 40;

function useCurrentTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

interface GratitudeListProps {
  items: Array<{ id?: string; ordinal: number; text: string }>;
  onAdd: (text: string) => void;
  onDelete: (index: number) => void;
  isLoading: boolean;
}

function GratitudeList({ items, onAdd, onDelete, isLoading }: GratitudeListProps) {
  const MIN_SLOTS = 3;
  const [slotTexts, setSlotTexts] = useState<Record<number, string>>({});
  const [isSuggesting, setIsSuggesting] = useState(false);
  const slotRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleSlotSubmit = (slotIndex: number) => {
    const text = (slotTexts[slotIndex] || "").trim();
    if (!text) return;
    onAdd(text);
    setSlotTexts((prev) => {
      const next = { ...prev };
      delete next[slotIndex];
      return next;
    });
  };

  const handleSlotKeyDown = (e: React.KeyboardEvent, slotIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSlotSubmit(slotIndex);
    }
  };

  const handleAiSuggest = async () => {
    setIsSuggesting(true);
    try {
      const res = await fetch("/api/coach/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "gratitude-prompt" }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.suggestion) {
        const firstEmptySlot = items.length;
        setSlotTexts((prev) => ({ ...prev, [firstEmptySlot]: data.suggestion }));
        setTimeout(() => slotRefs.current[firstEmptySlot]?.focus(), 50);
      }
    } catch {
    } finally {
      setIsSuggesting(false);
    }
  };

  const atMax = items.length >= 6;
  const emptySlotCount = atMax ? 0 : Math.max(0, MIN_SLOTS - items.length);

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  return (
    <div className="space-y-1" data-testid="gratitude-list">
      {items.map((item, i) => (
        <div
          key={item.id || i}
          className="group flex items-center gap-2 py-1 px-1 rounded-md"
          data-testid={`gratitude-item-${i}`}
        >
          <span className="text-xs font-medium text-muted-foreground w-4 text-right shrink-0">
            {i + 1}.
          </span>
          <span className="flex-1 text-sm">{item.text}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(i)}
            className="invisible group-hover:visible shrink-0"
            data-testid={`gratitude-delete-${i}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {Array.from({ length: emptySlotCount }, (_, si) => {
        const slotIndex = items.length + si;
        return (
          <div key={`slot-${si}`} className="flex items-start gap-2">
            <span className="text-xs font-medium text-muted-foreground mt-2.5 w-4 text-right shrink-0">
              {slotIndex + 1}.
            </span>
            <input
              ref={(el) => { slotRefs.current[slotIndex] = el; }}
              type="text"
              value={slotTexts[slotIndex] || ""}
              onChange={(e) => setSlotTexts((prev) => ({ ...prev, [slotIndex]: e.target.value }))}
              onKeyDown={(e) => handleSlotKeyDown(e, slotIndex)}
              onBlur={() => handleSlotSubmit(slotIndex)}
              placeholder="What are you grateful for today?"
              className="flex-1 bg-transparent border-b border-border/50 focus:border-primary/50 outline-none py-1.5 text-sm transition-colors placeholder:text-muted-foreground/50"
              data-testid={`gratitude-slot-${slotIndex}`}
            />
          </div>
        );
      })}

      {atMax ? (
        <p className="text-xs text-muted-foreground pl-6" data-testid="gratitude-max-label">
          6/6 gratitudes
        </p>
      ) : (
        <div className="flex items-center justify-end gap-1 pt-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleAiSuggest}
            disabled={isSuggesting || atMax}
            title="Get AI gratitude suggestion"
            data-testid="gratitude-ai-suggest"
          >
            {isSuggesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              const firstEmptySlot = items.length;
              slotRefs.current[firstEmptySlot]?.focus();
            }}
            disabled={atMax}
            data-testid="gratitude-add-btn"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function DailyPlannerView({ date }: DailyPlannerViewProps) {
  const queryClient = useQueryClient();
  const dateString = formatDateParam(date);
  const viewingToday = isToday(date);
  const now = useCurrentTime();

  const [priorities, setPriorities] = useState<string[]>(["", "", ""]);
  const [wentWells, setWentWells] = useState<string[]>(["", "", ""]);
  const [gratitudeItems, setGratitudeItems] = useState<Array<{ id?: string; ordinal: number; text: string }>>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [selectedBlueprintTodos, setSelectedBlueprintTodos] = useState<Set<string>>(new Set());
  const todoInputRef = useRef<HTMLInputElement>(null);

  const { data: dailyPlan, isLoading } = useQuery<DailyPlanData>({
    queryKey: ["planner", "daily", dateString],
    queryFn: async () => {
      const res = await fetch(`/api/planner/daily?date=${dateString}`);
      if (!res.ok) throw new Error("Failed to fetch daily plan");
      return res.json();
    },
  });

  const dayStart = useMemo(() => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [date]);

  const dayEnd = useMemo(() => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [date]);

  const { data: calendarEvents = [] } = useQuery<any[]>({
    queryKey: ["/api/calendar/events", dateString],
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar/events?start=${dayStart.toISOString()}&end=${dayEnd.toISOString()}`
      );
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventDialogMode, setEventDialogMode] = useState<"create" | "edit">("create");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [newEventDefaults, setNewEventDefaults] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  const handleEventClick = useCallback((event: any) => {
    setSelectedEvent(event);
    setEventDialogMode("edit");
    setEventDialogOpen(true);
  }, []);

  const handleSlotClick = useCallback(
    (hour: number) => {
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(date);
      end.setHours(hour + 1, 0, 0, 0);

      const offset = start.getTimezoneOffset();
      const localStart = new Date(start.getTime() - offset * 60000).toISOString().slice(0, 16);
      const localEnd = new Date(end.getTime() - offset * 60000).toISOString().slice(0, 16);

      setNewEventDefaults({ start: localStart, end: localEnd });
      setSelectedEvent(null);
      setEventDialogMode("create");
      setEventDialogOpen(true);
    },
    [date]
  );

  const weekStart = useMemo(() => getWeekStart(date), [date]);
  const weekStartStr = formatDateParam(weekStart);

  const { data: blueprintDailyData } = useQuery<DailyPlanData>({
    queryKey: ["planner", "daily", weekStartStr, "blueprint-source"],
    queryFn: async () => {
      const res = await fetch(`/api/planner/daily?date=${weekStartStr}`);
      if (!res.ok) throw new Error("Failed to fetch Blueprint daily plan");
      return res.json();
    },
    enabled: weekStartStr !== dateString,
  });

  const blueprintTodos = useMemo<BlueprintTodoItem[]>(() => {
    if (!blueprintDailyData) return [];
    return (blueprintDailyData.todos || []).filter(
      (t) => t.source === "wds" && !t.completed
    );
  }, [blueprintDailyData]);

  useEffect(() => {
    if (!dailyPlan) return;

    const p = ["", "", ""];
    (dailyPlan.priorities || []).forEach((item) => {
      if (item.ordinal >= 0 && item.ordinal < 3) {
        p[item.ordinal] = item.text ?? "";
      }
    });
    setPriorities(p);

    const w = ["", "", ""];
    (dailyPlan.wentWells || []).forEach((item) => {
      if (item.ordinal >= 0 && item.ordinal < 3) {
        w[item.ordinal] = item.text ?? "";
      }
    });
    setWentWells(w);

    const gItems = (dailyPlan.gratitudes || [])
      .filter((g) => g.text && g.text.length > 0)
      .map((g) => ({ id: g.id, ordinal: g.ordinal, text: g.text! }));
    setGratitudeItems(gItems);

    const t = (dailyPlan.todos || []).map((todo) => ({
      id: todo.id,
      text: todo.text,
      completed: todo.completed,
      ordinal: todo.ordinal,
      source: todo.source,
    }));
    setTodos(t);

    setInitialized(true);
  }, [dailyPlan]);

  const priorityData = useMemo(() => {
    if (!dailyPlan?.id) return null;
    return {
      dailyPlanId: dailyPlan.id,
      items: priorities.map((text, i) => ({ ordinal: i, text })),
    };
  }, [priorities, dailyPlan?.id]);

  const savePriorities = useCallback(
    async (payload: typeof priorityData) => {
      if (!payload) return;
      const res = await fetch("/api/planner/daily/priorities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save priorities");
    },
    []
  );

  const wentWellData = useMemo(() => {
    if (!dailyPlan?.id) return null;
    return {
      dailyPlanId: dailyPlan.id,
      items: wentWells.map((text, i) => ({ ordinal: i, text })),
    };
  }, [wentWells, dailyPlan?.id]);

  const saveWentWells = useCallback(
    async (payload: typeof wentWellData) => {
      if (!payload) return;
      const res = await fetch("/api/planner/daily/went-wells", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save went wells");
    },
    []
  );

  const { status: priorityStatus } = useAutosave({
    data: priorityData,
    onSave: savePriorities as (data: typeof priorityData) => Promise<void>,
    debounceMs: 1500,
    enabled: initialized && !!priorityData,
  });

  const { status: wentWellStatus } = useAutosave({
    data: wentWellData,
    onSave: saveWentWells as (data: typeof wentWellData) => Promise<void>,
    debounceMs: 1500,
    enabled: initialized && !!wentWellData,
  });

  const overallStatus = useMemo(() => {
    const statuses = [priorityStatus, wentWellStatus];
    if (statuses.some((s) => s === "error")) return "error";
    if (statuses.some((s) => s === "saving")) return "saving";
    if (statuses.some((s) => s === "saved")) return "saved";
    return "idle";
  }, [priorityStatus, wentWellStatus]);

  useEffect(() => {
    if (overallStatus === "saved") {
      queryClient.invalidateQueries({ queryKey: ["stats", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["plan", "today"] });
      queryClient.invalidateQueries({ queryKey: ["streaks"] });
      queryClient.invalidateQueries({ queryKey: ["activity", "recent"] });
    }
  }, [overallStatus, queryClient]);

  const handlePriorityChange = useCallback((index: number, value: string) => {
    setPriorities((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleWentWellChange = useCallback((index: number, value: string) => {
    setWentWells((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleGratitudeAdd = useCallback(
    async (text: string) => {
      if (!dailyPlan?.id) return;
      const ordinal = gratitudeItems.length;
      if (ordinal >= 6) return;

      const optimistic = { ordinal, text };
      setGratitudeItems((prev) => [...prev, optimistic]);

      try {
        const res = await fetch("/api/planner/daily/gratitudes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dailyPlanId: dailyPlan.id,
            items: [...gratitudeItems, { ordinal, text }].map((g, i) => ({ ordinal: i, text: g.text })),
          }),
        });
        if (!res.ok) throw new Error("Failed to save gratitude");
        queryClient.invalidateQueries({ queryKey: ["planner", "daily", dateString] });
      } catch {
        setGratitudeItems((prev) => prev.slice(0, -1));
      }
    },
    [dailyPlan?.id, gratitudeItems, queryClient, dateString]
  );

  const handleGratitudeDelete = useCallback(
    async (index: number) => {
      if (!dailyPlan?.id) return;
      const updated = gratitudeItems.filter((_, i) => i !== index).map((g, i) => ({ ...g, ordinal: i }));
      const removed = [...gratitudeItems];
      setGratitudeItems(updated);

      try {
        const res = await fetch("/api/planner/daily/gratitudes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dailyPlanId: dailyPlan.id,
            items: updated.map((g, i) => ({ ordinal: i, text: g.text })),
          }),
        });
        if (!res.ok) throw new Error("Failed to delete gratitude");
        queryClient.invalidateQueries({ queryKey: ["planner", "daily", dateString] });
      } catch {
        setGratitudeItems(removed);
      }
    },
    [dailyPlan?.id, gratitudeItems, queryClient, dateString]
  );

  const handleTodoAdd = useCallback(
    async (text: string) => {
      if (!dailyPlan?.id) return;
      const ordinal = todos.length;
      const optimistic: TodoItem = { text, completed: false, ordinal, source: "manual" };
      setTodos((prev) => [...prev, optimistic]);

      try {
        const res = await fetch("/api/planner/daily/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dailyPlanId: dailyPlan.id, text, source: "manual" }),
        });
        if (!res.ok) throw new Error("Failed to add todo");
        queryClient.invalidateQueries({ queryKey: ["planner", "daily", dateString] });
      } catch {
        setTodos((prev) => prev.slice(0, -1));
      }
    },
    [dailyPlan?.id, todos.length, queryClient, dateString]
  );

  const handleTodoToggle = useCallback(
    async (index: number) => {
      const todo = todos[index];
      if (!todo?.id) return;

      setTodos((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], completed: !next[index].completed };
        return next;
      });

      try {
        const res = await fetch("/api/planner/daily/todos", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: todo.id, completed: !todo.completed }),
        });
        if (!res.ok) throw new Error("Failed to toggle todo");
      } catch {
        setTodos((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], completed: !next[index].completed };
          return next;
        });
      }
    },
    [todos]
  );

  const handleTodoUpdate = useCallback(
    async (index: number, text: string) => {
      const todo = todos[index];
      if (!todo?.id) return;

      setTodos((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], text };
        return next;
      });

      try {
        const res = await fetch("/api/planner/daily/todos", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: todo.id, text }),
        });
        if (!res.ok) throw new Error("Failed to update todo");
      } catch {
        queryClient.invalidateQueries({ queryKey: ["planner", "daily", dateString] });
      }
    },
    [todos, queryClient, dateString]
  );

  const handleTodoDelete = useCallback(
    async (index: number) => {
      const todo = todos[index];
      if (!todo?.id) return;

      setTodos((prev) => prev.filter((_, i) => i !== index));

      try {
        const res = await fetch("/api/planner/daily/todos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: todo.id }),
        });
        if (!res.ok) throw new Error("Failed to delete todo");
        queryClient.invalidateQueries({ queryKey: ["planner", "daily", dateString] });
      } catch {
        queryClient.invalidateQueries({ queryKey: ["planner", "daily", dateString] });
      }
    },
    [todos, queryClient, dateString]
  );

  const handlePullFromBlueprint = useCallback(
    async (blueprintTodo: BlueprintTodoItem) => {
      if (!dailyPlan?.id) return;
      const ordinal = todos.length;
      const optimistic: TodoItem = { text: blueprintTodo.text, completed: false, ordinal, source: "wds" };
      setTodos((prev) => [...prev, optimistic]);

      try {
        const res = await fetch("/api/planner/daily/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dailyPlanId: dailyPlan.id, text: blueprintTodo.text, source: "wds" }),
        });
        if (!res.ok) throw new Error("Failed to pull Blueprint todo");
        queryClient.invalidateQueries({ queryKey: ["planner", "daily", dateString] });
      } catch {
        setTodos((prev) => prev.slice(0, -1));
      }
    },
    [dailyPlan?.id, todos.length, queryClient, dateString]
  );

  const handleBlueprintSelect = useCallback(
    async (todoId: string, checked: boolean) => {
      if (!checked) {
        setSelectedBlueprintTodos((prev) => {
          const next = new Set(prev);
          next.delete(todoId);
          return next;
        });
        return;
      }

      const todo = blueprintTodos.find((t) => t.id === todoId);
      if (todo) {
        await handlePullFromBlueprint(todo);
      }
      setSelectedBlueprintTodos((prev) => {
        const next = new Set(prev);
        next.add(todoId);
        return next;
      });
    },
    [blueprintTodos, handlePullFromBlueprint]
  );

  const isAfter5pm = now.getHours() >= 17;

  const scheduleHours = useMemo(() => {
    const h: number[] = [];
    for (let i = SCHEDULE_START_HOUR; i <= SCHEDULE_END_HOUR; i++) h.push(i);
    return h;
  }, []);

  const nowLineTop = useMemo(() => {
    if (!viewingToday) return null;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    if (currentHour < SCHEDULE_START_HOUR || currentHour >= SCHEDULE_END_HOUR) return null;
    const allDayRowHeight = 40;
    return allDayRowHeight + (currentHour - SCHEDULE_START_HOUR) * ROW_HEIGHT + (currentMinute / 60) * ROW_HEIGHT;
  }, [viewingToday, now]);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="daily-planner-skeleton">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-[25%] space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="w-full lg:w-[45%]">
            <Skeleton className="h-[600px] w-full" />
          </div>
          <div className="w-full lg:w-[30%] space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="daily-planner-view">
      <div className="flex items-center justify-end min-h-[20px]">
        {overallStatus === "saving" && (
          <span className="text-xs text-muted-foreground" data-testid="autosave-saving">
            Saving...
          </span>
        )}
        {overallStatus === "saved" && (
          <span className="text-xs text-green-500" data-testid="autosave-saved">
            Saved
          </span>
        )}
        {overallStatus === "error" && (
          <span className="text-xs text-red-500" data-testid="autosave-error">
            Save failed
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column — The Day */}
        <div className="w-full lg:w-[25%] space-y-6" data-testid="column-the-day">
          <Card className="border-dashed p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Heart className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">Healthset</span>
              <Badge variant="secondary" className="text-xs" data-testid="badge-healthset-coming-soon">
                Coming Soon
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Connect Apple Health or Samsung Health
            </p>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Gratitude</span>
            </div>
            <GratitudeList
              items={gratitudeItems}
              onAdd={handleGratitudeAdd}
              onDelete={handleGratitudeDelete}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Center Column — Schedule */}
        <div className="w-full lg:w-[45%]" data-testid="column-schedule">
          <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Schedule
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => handleSlotClick(9)}
              data-testid="button-add-event"
            >
              <Plus className="h-3 w-3" />
              Add Event
            </Button>
          </div>

          <Card className="p-0 overflow-visible relative" data-testid="schedule-card">
            <div
              className="flex items-center border-b border-border/50 min-h-[40px] px-2"
              data-testid="schedule-all-day"
            >
              <span className="text-xs text-muted-foreground w-[60px] shrink-0 text-right pr-3">
                All Day
              </span>
              <div className="flex-1">
                <AllDayEvents events={calendarEvents} onEventClick={handleEventClick} />
              </div>
            </div>

            <div className="relative">
              {nowLineTop !== null && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: `${nowLineTop - 40}px` }}
                  data-testid="now-line"
                >
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <div className="flex-1 border-t-2 border-red-500" />
                  </div>
                </div>
              )}

              <CalendarEventBlocks
                events={calendarEvents}
                dayStart={dayStart}
                onEventClick={handleEventClick}
              />

              {scheduleHours.map((hour) => (
                <div
                  key={hour}
                  className="flex items-start border-b border-border/30 min-h-[40px] cursor-pointer hover:bg-muted/30 transition-colors"
                  data-testid={`schedule-row-${hour}`}
                  onClick={() => handleSlotClick(hour)}
                >
                  <span className="text-xs text-muted-foreground w-[60px] shrink-0 text-right pr-3 pt-1">
                    {formatTime(hour)}
                  </span>
                  <div className="flex-1 min-h-[40px]" />
                </div>
              ))}
            </div>
          </Card>

          <CalendarEventDialog
            open={eventDialogOpen}
            onOpenChange={setEventDialogOpen}
            mode={eventDialogMode}
            event={selectedEvent || undefined}
            defaultStart={newEventDefaults.start}
            defaultEnd={newEventDefaults.end}
            dateStr={dateString}
          />
        </div>

        {/* Right Column — Execute & Reflect */}
        <div className="w-full lg:w-[30%] space-y-6" data-testid="column-execute-reflect">
          <div className="space-y-3">
            <ColoredSectionHeader
              title="To-Do"
              color="blue"
              icon={<CheckSquare className="h-4 w-4" />}
            />
            <TodoList
              items={todos}
              onAdd={handleTodoAdd}
              onToggle={handleTodoToggle}
              onUpdate={handleTodoUpdate}
              onDelete={handleTodoDelete}
              placeholder="Add a to-do..."
              testIdPrefix="daily-todo"
              inputRef={todoInputRef}
              blueprintTodos={blueprintTodos.map((t) => ({ id: t.id, text: t.text }))}
              selectedBlueprintIds={selectedBlueprintTodos}
              onBlueprintSelect={handleBlueprintSelect}
            />
          </div>

          <div className="space-y-3">
            <ColoredSectionHeader
              title="Priorities"
              color="amber"
              icon={<Target className="h-4 w-4" />}
            />
            <NumberedInputGroup
              count={3}
              values={priorities}
              onChange={handlePriorityChange}
              placeholders={[
                "What's priority #1 today?",
                "What's priority #2 today?",
                "What's priority #3 today?",
              ]}
              testIdPrefix="priority"
            />
          </div>

          <div className={cn("space-y-3", isAfter5pm && viewingToday && "ring-1 ring-green-500/30 rounded-md p-3")}>
            <ColoredSectionHeader
              title="Went Well"
              color="green"
              icon={<ThumbsUp className="h-4 w-4" />}
            />
            <NumberedInputGroup
              count={3}
              values={wentWells}
              onChange={handleWentWellChange}
              placeholder="What went well today?"
              testIdPrefix="went-well"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
