"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAutosave } from "@/hooks/useAutosave";
import { ColoredSectionHeader } from "./ColoredSectionHeader";
import { NumberedInputGroup } from "./NumberedInputGroup";
import { TodoList, TodoItem } from "./TodoList";
import { formatDateParam, getWeekDates, getShortDayName, formatTime, isToday } from "@/lib/planner-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Briefcase, CheckSquare, Sparkles, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BlueprintViewProps {
  weekStart: Date;
  onDayClick: (date: Date) => void;
}

interface TrulyExceptionalItem {
  id?: string;
  category: string;
  ordinal: number;
  text: string | null;
  source?: string;
}

interface WeekData {
  id: string;
  trulyExceptionals: TrulyExceptionalItem[];
}

interface DailyPlanData {
  id: string;
  todos: Array<{
    id: string;
    text: string;
    completed: boolean;
    ordinal: number;
    source: string;
  }>;
}

const SCHEDULE_START_HOUR = 5;
const SCHEDULE_END_HOUR = 22;

interface WeekCalendarEvent {
  id: string;
  provider: "GOOGLE" | "MICROSOFT";
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  eversteadOwned: boolean;
}

function getEventBorderColor(provider: string, eversteadOwned: boolean): string {
  if (eversteadOwned) return "hsl(var(--primary))";
  if (provider === "GOOGLE") return "#4285f4";
  if (provider === "MICROSOFT") return "#00a4ef";
  return "#6b7280";
}

function BlueprintScheduleGrid({
  weekStart,
  onDayClick,
}: {
  weekStart: Date;
  onDayClick: (date: Date) => void;
}) {
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const hours = useMemo(() => {
    const h: number[] = [];
    for (let i = SCHEDULE_START_HOUR; i <= SCHEDULE_END_HOUR; i++) h.push(i);
    return h;
  }, []);

  const weekStartISO = useMemo(() => {
    const d = new Date(weekStart);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [weekStart]);

  const weekEndISO = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [weekStart]);

  const weekStartStr = formatDateParam(weekStart);

  const { data: weekEvents = [] } = useQuery<WeekCalendarEvent[]>({
    queryKey: ["/api/calendar/events", "week", weekStartStr],
    queryFn: async () => {
      const res = await fetch(
        `/api/calendar/events?start=${weekStartISO}&end=${weekEndISO}`
      );
      if (!res.ok) return [];
      return res.json();
    },
  });

  interface WeekPositionedEvent extends WeekCalendarEvent {
    top: number;
    height: number;
    column: number;
    totalColumns: number;
  }

  const eventsByDay = useMemo(() => {
    const ROW_H = 28;
    const map: Record<number, WeekPositionedEvent[]> = {};
    for (const event of weekEvents) {
      if (event.isAllDay) continue;
      const start = new Date(event.start);
      const end = new Date(event.end);
      const dayIdx = weekDates.findIndex((d) =>
        d.getFullYear() === start.getFullYear() &&
        d.getMonth() === start.getMonth() &&
        d.getDate() === start.getDate()
      );
      if (dayIdx === -1) continue;

      const startHour = start.getHours() + start.getMinutes() / 60;
      const endHour = end.getHours() + end.getMinutes() / 60;
      const clampedStart = Math.max(startHour, SCHEDULE_START_HOUR);
      const clampedEnd = Math.min(endHour, SCHEDULE_END_HOUR + 1);
      if (clampedEnd <= clampedStart) continue;

      const top = (clampedStart - SCHEDULE_START_HOUR) * ROW_H;
      const height = Math.max((clampedEnd - clampedStart) * ROW_H, 16);

      if (!map[dayIdx]) map[dayIdx] = [];
      map[dayIdx].push({ ...event, top, height, column: 0, totalColumns: 1 });
    }

    for (const dayIdx of Object.keys(map)) {
      const dayEvents = map[Number(dayIdx)];
      const sorted = [...dayEvents].sort((a, b) => a.top - b.top || b.height - a.height);
      const columns: WeekPositionedEvent[][] = [];
      for (const ev of sorted) {
        let placedCol = -1;
        for (let c = 0; c < columns.length; c++) {
          if (columns[c].every((ce) => ev.top >= ce.top + ce.height || ev.top + ev.height <= ce.top)) {
            placedCol = c;
            break;
          }
        }
        if (placedCol === -1) {
          placedCol = columns.length;
          columns.push([]);
        }
        columns[placedCol].push(ev);
      }
      const totalCols = Math.min(columns.length, 3);
      const result: WeekPositionedEvent[] = [];
      for (let c = 0; c < columns.length; c++) {
        for (const ev of columns[c]) {
          result.push({ ...ev, column: Math.min(c, 2), totalColumns: totalCols });
        }
      }
      map[Number(dayIdx)] = result;
    }

    return map;
  }, [weekEvents, weekDates]);

  return (
    <Card className="p-0 overflow-hidden" data-testid="blueprint-schedule-grid">
      <div className="overflow-x-auto">
        <div className="min-w-[700px] relative">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
            <div className="p-2" />
            {weekDates.map((date, i) => {
              const today = isToday(date);
              const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              const label = `${getShortDayName(i)} ${months[date.getMonth()]} ${date.getDate()}`;
              return (
                <Button
                  key={i}
                  variant="ghost"
                  onClick={() => onDayClick(date)}
                  className={`rounded-none text-xs font-medium py-2 ${
                    today ? "border-t-2 border-t-primary" : ""
                  }`}
                  data-testid={`blueprint-day-header-${i}`}
                >
                  {label}
                </Button>
              );
            })}
          </div>

          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            <div>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="px-2 text-[10px] text-muted-foreground/70 text-right pr-3 border-b border-border/20"
                  style={{ height: "28px", lineHeight: "28px" }}
                >
                  {formatTime(hour)}
                </div>
              ))}
            </div>
            {weekDates.map((_, dayIdx) => (
              <div key={dayIdx} className={`relative border-l border-border/40 ${dayIdx % 2 === 1 ? "bg-muted/5" : ""}`}>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-border/20"
                    style={{ height: "28px" }}
                    data-testid={`blueprint-cell-${hour}-${dayIdx}`}
                  />
                ))}

                {(eventsByDay[dayIdx] || []).map((ev) => {
                  const startTime = new Date(ev.start).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const endTime = new Date(ev.end).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const colWidth = 100 / ev.totalColumns;
                  const leftPct = ev.column * colWidth;
                  return (
                    <Tooltip key={ev.id}>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute text-[9px] leading-tight truncate rounded px-0.5 py-0.5 cursor-default overflow-hidden z-[2]"
                          style={{
                            top: `${ev.top}px`,
                            height: `${ev.height}px`,
                            left: `calc(${leftPct}% + 1px)`,
                            width: `calc(${colWidth}% - 2px)`,
                            borderLeft: `2px solid ${getEventBorderColor(ev.provider, ev.eversteadOwned)}`,
                            backgroundColor: ev.provider === "GOOGLE"
                              ? "rgba(66,133,244,0.12)"
                              : ev.provider === "MICROSOFT"
                              ? "rgba(0,164,239,0.12)"
                              : "rgba(var(--primary),0.12)",
                          }}
                          data-testid={`week-event-${ev.id}`}
                        >
                          <span className="font-medium truncate block">{ev.title}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[200px]">
                        <p className="font-medium">{ev.title}</p>
                        <p className="text-muted-foreground">
                          {startTime} – {endTime}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function BlueprintIntentionPanel({
  personalTEs,
  professionalTEs,
  onPersonalChange,
  onProfessionalChange,
  todos,
  onTodoAdd,
  onTodoToggle,
  onTodoUpdate,
  onTodoDelete,
  isLoading,
}: {
  personalTEs: string[];
  professionalTEs: string[];
  onPersonalChange: (index: number, value: string) => void;
  onProfessionalChange: (index: number, value: string) => void;
  todos: TodoItem[];
  onTodoAdd: (text: string) => void;
  onTodoToggle: (index: number) => void;
  onTodoUpdate: (index: number, text: string) => void;
  onTodoDelete: (index: number) => void;
  isLoading: boolean;
}) {
  const { toast } = useToast();
  const [suggestingCategory, setSuggestingCategory] = useState<string | null>(null);

  const handleTeSuggest = async (category: "personal" | "professional") => {
    const values = category === "personal" ? personalTEs : professionalTEs;
    const emptyIdx = values.findIndex((v) => !v || v.trim() === "");
    if (emptyIdx === -1) {
      toast({ title: "All filled", description: "Clear a goal slot to get an AI suggestion." });
      return;
    }

    setSuggestingCategory(category);
    try {
      const res = await fetch("/api/coach/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "te-suggestion",
          context: { category },
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.suggestion) {
        const onChange = category === "personal" ? onPersonalChange : onProfessionalChange;
        onChange(emptyIdx, data.suggestion);
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to get suggestion." });
    } finally {
      setSuggestingCategory(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="blueprint-intention-skeleton">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="blueprint-intention-panel">
      <div className="pl-4 border-l-2 border-primary/30 mb-6">
        <p className="text-base italic text-muted-foreground" data-testid="text-blueprint-prompt">
          &ldquo;What 3 things must happen over the next 7 days for me to feel this week was very successful?&rdquo;
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ColoredSectionHeader
            title="Personal Truly Exceptionals"
            color="blue"
            icon={<Star className="h-4 w-4" />}
          />
          {personalTEs.some((v) => !v || v.trim() === "") && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleTeSuggest("personal")}
              disabled={suggestingCategory === "personal"}
              title="Get AI goal suggestion"
              data-testid="te-personal-ai-suggest"
            >
              {suggestingCategory === "personal" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
        <NumberedInputGroup
          count={3}
          values={personalTEs}
          onChange={onPersonalChange}
          placeholder="Set a personal goal for this week"
          testIdPrefix="te-personal"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ColoredSectionHeader
            title="Professional Truly Exceptionals"
            color="amber"
            icon={<Briefcase className="h-4 w-4" />}
          />
          {professionalTEs.some((v) => !v || v.trim() === "") && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleTeSuggest("professional")}
              disabled={suggestingCategory === "professional"}
              title="Get AI goal suggestion"
              data-testid="te-professional-ai-suggest"
            >
              {suggestingCategory === "professional" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
        <NumberedInputGroup
          count={3}
          values={professionalTEs}
          onChange={onProfessionalChange}
          placeholder="Set a professional goal for this week"
          testIdPrefix="te-professional"
        />
      </div>

      <div className="space-y-3">
        <ColoredSectionHeader
          title="To-Dos / Deliverables"
          color="green"
          icon={<CheckSquare className="h-4 w-4" />}
        />
        <TodoList
          items={todos}
          onAdd={onTodoAdd}
          onToggle={onTodoToggle}
          onUpdate={onTodoUpdate}
          onDelete={onTodoDelete}
          placeholder="Add a weekly to-do..."
          addLabel="Add to-do"
          testIdPrefix="blueprint-todo"
        />
      </div>
    </div>
  );
}

export default function BlueprintView({ weekStart, onDayClick }: BlueprintViewProps) {
  const queryClient = useQueryClient();
  const weekStartStr = formatDateParam(weekStart);

  const [personalTEs, setPersonalTEs] = useState<string[]>(["", "", ""]);
  const [professionalTEs, setProfessionalTEs] = useState<string[]>(["", "", ""]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  const { data: weekData, isLoading: weekLoading } = useQuery<WeekData>({
    queryKey: ["planner", "week", weekStartStr],
    queryFn: async () => {
      const res = await fetch(`/api/planner/week?weekStart=${weekStartStr}`);
      if (!res.ok) throw new Error("Failed to fetch week data");
      return res.json();
    },
  });

  const { data: dailyData, isLoading: dailyLoading } = useQuery<DailyPlanData>({
    queryKey: ["planner", "daily", weekStartStr],
    queryFn: async () => {
      const res = await fetch(`/api/planner/daily?date=${weekStartStr}`);
      if (!res.ok) throw new Error("Failed to fetch daily plan");
      return res.json();
    },
  });

  useEffect(() => {
    if (!weekData) return;

    const tes = weekData.trulyExceptionals || [];
    const personal = ["", "", ""];
    const professional = ["", "", ""];

    tes.forEach((te) => {
      if (te.category === "personal" && te.ordinal >= 0 && te.ordinal < 3) {
        personal[te.ordinal] = te.text ?? "";
      }
      if (te.category === "professional" && te.ordinal >= 0 && te.ordinal < 3) {
        professional[te.ordinal] = te.text ?? "";
      }
    });

    setPersonalTEs(personal);
    setProfessionalTEs(professional);
    setInitialized(true);
  }, [weekData]);

  useEffect(() => {
    if (!dailyData) return;

    const blueprintTodos = (dailyData.todos || [])
      .filter((t) => t.source === "wds")
      .map((t) => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
        ordinal: t.ordinal,
        source: t.source,
      }));

    setTodos(blueprintTodos);
  }, [dailyData]);

  const teData = useMemo(() => {
    if (!weekData?.id) return null;
    const items: { category: string; ordinal: number; text: string; source: string }[] = [];
    personalTEs.forEach((text, i) => {
      items.push({ category: "personal", ordinal: i, text, source: "review_set" });
    });
    professionalTEs.forEach((text, i) => {
      items.push({ category: "professional", ordinal: i, text, source: "review_set" });
    });
    return { weekId: weekData.id, items };
  }, [personalTEs, professionalTEs, weekData?.id]);

  const saveTEs = useCallback(
    async (payload: { weekId: string; items: { category: string; ordinal: number; text: string; source: string }[] }) => {
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
    data: teData,
    onSave: saveTEs as (data: typeof teData) => Promise<void>,
    debounceMs: 1500,
    enabled: initialized && !!teData,
  });

  const handlePersonalChange = useCallback((index: number, value: string) => {
    setPersonalTEs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleProfessionalChange = useCallback((index: number, value: string) => {
    setProfessionalTEs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleTodoAdd = useCallback(
    async (text: string) => {
      if (!dailyData?.id) return;
      const ordinal = todos.length;
      const optimistic: TodoItem = { text, completed: false, ordinal, source: "wds" };
      setTodos((prev) => [...prev, optimistic]);

      try {
        const res = await fetch("/api/planner/daily/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dailyPlanId: dailyData.id, text, source: "wds" }),
        });
        if (!res.ok) throw new Error("Failed to add todo");
        queryClient.invalidateQueries({ queryKey: ["planner", "daily", weekStartStr] });
      } catch {
        setTodos((prev) => prev.slice(0, -1));
      }
    },
    [dailyData?.id, todos.length, queryClient, weekStartStr]
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
        queryClient.invalidateQueries({ queryKey: ["planner", "daily", weekStartStr] });
      }
    },
    [todos, queryClient, weekStartStr]
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
        queryClient.invalidateQueries({ queryKey: ["planner", "daily", weekStartStr] });
      } catch {
        queryClient.invalidateQueries({ queryKey: ["planner", "daily", weekStartStr] });
      }
    },
    [todos, queryClient, weekStartStr]
  );

  const isLoading = weekLoading || dailyLoading;

  return (
    <div className="space-y-4" data-testid="blueprint-view">
      <div className="flex items-center justify-end min-h-[20px]">
        {status === "saving" && (
          <span className="text-xs text-muted-foreground" data-testid="autosave-saving">
            Saving...
          </span>
        )}
        {status === "saved" && (
          <span className="text-xs text-green-500" data-testid="autosave-saved">
            Saved
          </span>
        )}
        {status === "error" && (
          <span className="text-xs text-red-500" data-testid="autosave-error">
            Save failed
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[65%]">
          {isLoading ? (
            <Skeleton className="h-[500px] w-full rounded-md" data-testid="blueprint-schedule-skeleton" />
          ) : (
            <BlueprintScheduleGrid weekStart={weekStart} onDayClick={onDayClick} />
          )}
        </div>

        <div className="w-full lg:w-[35%]">
          <BlueprintIntentionPanel
            personalTEs={personalTEs}
            professionalTEs={professionalTEs}
            onPersonalChange={handlePersonalChange}
            onProfessionalChange={handleProfessionalChange}
            todos={todos}
            onTodoAdd={handleTodoAdd}
            onTodoToggle={handleTodoToggle}
            onTodoUpdate={handleTodoUpdate}
            onTodoDelete={handleTodoDelete}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
