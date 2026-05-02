import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useDrawer } from "@/contexts/DrawerContext";
import { useToast } from "@/contexts/ToastContext";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";
import type {
  CalendarEvent,
  DailyPlanData,
  DailyPlanTodo,
  NudgeResponse,
} from "@/lib/api";
import WeekView from "@/components/planner/WeekView";

const SCHEDULE_START_HOUR = 5;
const SCHEDULE_END_HOUR = 22;
const ROW_HEIGHT = 44;
const LEFT_GUTTER = 56;

function formatDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatHeaderDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getWeekStart(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function isSameWeek(a: Date, b: Date): boolean {
  const ws1 = getWeekStart(a);
  const ws2 = getWeekStart(b);
  return ws1.getTime() === ws2.getTime();
}

function formatWeekRange(weekStart: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const sameYear = weekStart.getFullYear() === end.getFullYear();
  if (sameMonth && sameYear) {
    return `${months[weekStart.getMonth()]} ${weekStart.getDate()} – ${end.getDate()}`;
  }
  if (sameYear) {
    return `${months[weekStart.getMonth()]} ${weekStart.getDate()} – ${months[end.getMonth()]} ${end.getDate()}`;
  }
  return `${months[weekStart.getMonth()]} ${weekStart.getDate()}, ${weekStart.getFullYear()} – ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

function formatHourLabel(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h} ${ampm}`;
}

function formatTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style);
}

function formatSaveError(label: string, e: unknown): string {
  const detail =
    e instanceof Error && e.message && !/^API error:/i.test(e.message)
      ? e.message
      : null;
  const base = `Couldn't save ${label}. Please try again.`;
  return detail ? `${base} (${detail})` : base;
}

function formatLoadError(label: string, e: unknown): string {
  const detail =
    e instanceof Error && e.message && !/^API error:/i.test(e.message)
      ? e.message
      : null;
  const base = `Couldn't load ${label}.`;
  return detail ? `${base} (${detail})` : base;
}

interface SectionHeaderProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  accent?: string;
}

function SectionHeader({ icon, title, accent = Colors.gold }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: Colors.goldLight }]}>
        <Feather name={icon} size={14} color={accent} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

interface PrioritiesProps {
  dailyPlanId?: string;
  initial: string[];
  onSaved: () => void;
}

function PrioritiesSection({ dailyPlanId, initial, onSaved }: PrioritiesProps) {
  const { showError } = useToast();
  const [values, setValues] = useState<string[]>(initial);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const dirtyRef = React.useRef(false);
  const initialRef = React.useRef<string[]>(initial);

  useEffect(() => {
    initialRef.current = initial;
    if (!dirtyRef.current) {
      setValues(initial);
    }
  }, [initial]);

  const handleChange = (i: number, t: string) => {
    dirtyRef.current = true;
    setValues((prev) => {
      const next = [...prev];
      next[i] = t;
      return next;
    });
  };

  const handleBlur = async (i: number) => {
    if (!dailyPlanId) return;
    if (values[i] === initialRef.current[i]) return;
    setSavingIdx(i);
    const snapshot = [...values];
    try {
      await api.savePriorities(
        dailyPlanId,
        snapshot.map((text, ordinal) => ({ ordinal, text })),
      );
      initialRef.current = snapshot;
      dirtyRef.current = false;
      onSaved();
    } catch (e) {
      setValues(initialRef.current);
      dirtyRef.current = false;
      showError(formatSaveError("priority", e));
    } finally {
      setSavingIdx(null);
    }
  };

  return (
    <View style={styles.card}>
      <SectionHeader icon="target" title="Top 3 Priorities" />
      {values.map((value, i) => (
        <View key={i} style={styles.priorityRow}>
          <View style={styles.priorityNum}>
            <Text style={styles.priorityNumText}>{i + 1}</Text>
          </View>
          <TextInput
            style={styles.priorityInput}
            value={value}
            placeholder={`Priority ${i + 1}`}
            placeholderTextColor={Colors.textTertiary}
            onChangeText={(t) => handleChange(i, t)}
            onBlur={() => handleBlur(i)}
            editable={!!dailyPlanId}
          />
          {savingIdx === i ? (
            <ActivityIndicator size="small" color={Colors.gold} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

interface GratitudesProps {
  dailyPlanId?: string;
  initial: Array<{ id?: string; ordinal: number; text: string }>;
  onSaved: () => void;
}

function GratitudesSection({ dailyPlanId, initial, onSaved }: GratitudesProps) {
  const MIN_SLOTS = 3;
  const MAX = 6;
  const { showError } = useToast();
  const [items, setItems] = useState(initial);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const persist = async (
    next: typeof items,
    rollback: typeof items,
  ) => {
    if (!dailyPlanId) return;
    setSaving(true);
    try {
      await api.saveGratitudes(
        dailyPlanId,
        next.map((g, i) => ({ ordinal: i, text: g.text })),
      );
      onSaved();
    } catch (e) {
      setItems(rollback);
      showError(formatSaveError("gratitude", e));
    } finally {
      setSaving(false);
    }
  };

  const submitSlot = async (slotIndex: number) => {
    const text = (drafts[slotIndex] || "").trim();
    if (!text) return;
    if (items.length >= MAX) return;
    const rollback = items;
    const optimistic = [...items, { ordinal: items.length, text }];
    setItems(optimistic);
    setDrafts((prev) => {
      const n = { ...prev };
      delete n[slotIndex];
      return n;
    });
    haptic();
    await persist(optimistic, rollback);
  };

  const removeAt = async (i: number) => {
    const rollback = items;
    const next = items.filter((_, idx) => idx !== i).map((g, idx) => ({ ...g, ordinal: idx }));
    setItems(next);
    haptic();
    await persist(next, rollback);
  };

  const emptySlotCount =
    items.length >= MAX ? 0 : Math.max(0, MIN_SLOTS - items.length);

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeaderRow}>
        <SectionHeader icon="heart" title="Gratitude" />
        {saving ? <ActivityIndicator size="small" color={Colors.gold} /> : null}
      </View>

      {items.map((item, i) => (
        <View key={item.id || `g-${i}`} style={styles.gratitudeRow}>
          <Text style={styles.gratitudeNum}>{i + 1}.</Text>
          <Text style={styles.gratitudeText}>{item.text}</Text>
          <Pressable
            onPress={() => removeAt(i)}
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Feather name="x" size={14} color={Colors.textSecondary} />
          </Pressable>
        </View>
      ))}

      {Array.from({ length: emptySlotCount }, (_, si) => {
        const slotIndex = items.length + si;
        return (
          <View key={`slot-${si}`} style={styles.gratitudeSlotRow}>
            <Text style={styles.gratitudeNum}>{slotIndex + 1}.</Text>
            <TextInput
              style={styles.gratitudeInput}
              value={drafts[slotIndex] || ""}
              placeholder="What are you grateful for?"
              placeholderTextColor={Colors.textTertiary}
              onChangeText={(t) =>
                setDrafts((prev) => ({ ...prev, [slotIndex]: t }))
              }
              onSubmitEditing={() => submitSlot(slotIndex)}
              onBlur={() => submitSlot(slotIndex)}
              returnKeyType="done"
              editable={!!dailyPlanId}
            />
          </View>
        );
      })}

      {items.length >= MAX ? (
        <Text style={styles.maxLabel}>{MAX}/{MAX} gratitudes</Text>
      ) : null}
    </View>
  );
}

interface TodoSectionProps {
  dailyPlanId?: string;
  initial: DailyPlanTodo[];
  onChange: () => void;
}

function TodoSection({ dailyPlanId, initial, onChange }: TodoSectionProps) {
  const { showError } = useToast();
  const [todos, setTodos] = useState<DailyPlanTodo[]>(initial);
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setTodos(initial);
  }, [initial]);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text || !dailyPlanId) return;
    setAdding(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic: DailyPlanTodo = {
      id: tempId,
      text,
      completed: false,
      ordinal: todos.length,
      source: "manual",
    };
    setTodos((prev) => [...prev, optimistic]);
    setNewText("");
    haptic();
    try {
      const created = await api.addTodo(dailyPlanId, text, "manual");
      setTodos((prev) => prev.map((t) => (t.id === tempId ? created : t)));
      onChange();
    } catch (e) {
      setTodos((prev) => prev.filter((t) => t.id !== tempId));
      setNewText(text);
      showError(formatSaveError("to-do", e));
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (todo: DailyPlanTodo) => {
    const target = !todo.completed;
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, completed: target } : t)),
    );
    haptic();
    try {
      await api.updateTodo(todo.id, { completed: target });
      onChange();
    } catch (e) {
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, completed: !target } : t)),
      );
      showError(formatSaveError("to-do", e));
    }
  };

  const remove = async (todo: DailyPlanTodo) => {
    const prev = todos;
    setTodos((cur) => cur.filter((t) => t.id !== todo.id));
    haptic();
    try {
      await api.deleteTodo(todo.id);
      onChange();
    } catch (e) {
      setTodos(prev);
      showError(formatSaveError("to-do", e));
    }
  };

  return (
    <View style={styles.card}>
      <SectionHeader icon="check-square" title="To-Do List" />

      {todos.length === 0 ? (
        <Text style={styles.todoEmpty}>Add your first to-do below</Text>
      ) : (
        todos.map((todo) => (
          <View key={todo.id} style={styles.todoRow}>
            <Pressable
              onPress={() => toggle(todo)}
              style={({ pressed }) => [
                styles.checkbox,
                todo.completed && styles.checkboxChecked,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={6}
            >
              {todo.completed ? (
                <Feather name="check" size={14} color={Colors.white} />
              ) : null}
            </Pressable>
            <Text
              style={[
                styles.todoText,
                todo.completed && styles.todoTextDone,
              ]}
            >
              {todo.text}
            </Text>
            {todo.source === "wds" ? (
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceBadgeText}>BP</Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => remove(todo)}
              style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
              hitSlop={8}
            >
              <Feather name="x" size={14} color={Colors.textSecondary} />
            </Pressable>
          </View>
        ))
      )}

      <View style={styles.todoAddRow}>
        <TextInput
          style={styles.todoInput}
          value={newText}
          placeholder="Add a to-do…"
          placeholderTextColor={Colors.textTertiary}
          onChangeText={setNewText}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          editable={!!dailyPlanId && !adding}
        />
        <Pressable
          onPress={handleAdd}
          disabled={!newText.trim() || !dailyPlanId || adding}
          style={({ pressed }) => [
            styles.addBtn,
            (!newText.trim() || !dailyPlanId) && { opacity: 0.4 },
            pressed && { opacity: 0.8 },
          ]}
        >
          {adding ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Feather name="plus" size={18} color={Colors.white} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

interface ScheduleProps {
  events: CalendarEvent[];
  viewingToday: boolean;
}

function ScheduleSection({ events, viewingToday }: ScheduleProps) {
  const allDay = events.filter((e) => e.isAllDay);
  const timed = events.filter((e) => !e.isAllDay);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!viewingToday) return;
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, [viewingToday]);

  const positioned = useMemo(() => {
    return timed
      .map((e) => {
        const start = new Date(e.start);
        const end = new Date(e.end);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
        const startHour = start.getHours() + start.getMinutes() / 60;
        const endHour = end.getHours() + end.getMinutes() / 60;
        const clampedStart = Math.max(startHour, SCHEDULE_START_HOUR);
        const clampedEnd = Math.min(endHour, SCHEDULE_END_HOUR + 1);
        if (clampedEnd <= clampedStart) return null;
        const top = (clampedStart - SCHEDULE_START_HOUR) * ROW_HEIGHT;
        const height = Math.max((clampedEnd - clampedStart) * ROW_HEIGHT, 22);
        return { event: e, top, height, start, end };
      })
      .filter(
        (x): x is { event: CalendarEvent; top: number; height: number; start: Date; end: Date } =>
          x !== null,
      );
  }, [timed]);

  const nowLineTop = useMemo(() => {
    if (!viewingToday) return null;
    const h = now.getHours();
    const m = now.getMinutes();
    if (h < SCHEDULE_START_HOUR || h >= SCHEDULE_END_HOUR) return null;
    return (h - SCHEDULE_START_HOUR) * ROW_HEIGHT + (m / 60) * ROW_HEIGHT;
  }, [viewingToday, now]);

  const totalHeight = (SCHEDULE_END_HOUR - SCHEDULE_START_HOUR + 1) * ROW_HEIGHT;
  const hours: number[] = [];
  for (let h = SCHEDULE_START_HOUR; h <= SCHEDULE_END_HOUR; h++) hours.push(h);

  return (
    <View style={styles.card}>
      <SectionHeader icon="calendar" title="Schedule" />

      {allDay.length > 0 ? (
        <View style={styles.allDayRow}>
          {allDay.map((e) => (
            <View
              key={e.id}
              style={[
                styles.allDayChip,
                { borderLeftColor: providerColor(e) },
              ]}
            >
              <Text style={styles.allDayChipText} numberOfLines={1}>
                {e.title}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.scheduleGrid, { height: totalHeight }]}>
        {hours.map((h, idx) => (
          <View
            key={h}
            style={[
              styles.hourRow,
              { top: idx * ROW_HEIGHT, height: ROW_HEIGHT },
            ]}
          >
            <Text style={styles.hourLabel}>{formatHourLabel(h)}</Text>
            <View style={styles.hourLine} />
          </View>
        ))}

        {positioned.map(({ event, top, height, start, end }) => (
          <View
            key={event.id}
            style={[
              styles.eventBlock,
              {
                top,
                height,
                borderLeftColor: providerColor(event),
                backgroundColor: providerBg(event),
              },
            ]}
          >
            <Text style={styles.eventTitle} numberOfLines={1}>
              {event.title}
            </Text>
            {height >= 36 ? (
              <Text style={styles.eventTime} numberOfLines={1}>
                {formatTimeRange(start, end)}
              </Text>
            ) : null}
          </View>
        ))}

        {nowLineTop != null ? (
          <View style={[styles.nowLine, { top: nowLineTop }]}>
            <View style={styles.nowDot} />
            <View style={styles.nowBar} />
          </View>
        ) : null}
      </View>

      {timed.length === 0 && allDay.length === 0 ? (
        <Text style={styles.scheduleEmpty}>
          No calendar events for this day
        </Text>
      ) : null}
    </View>
  );
}

function providerColor(e: CalendarEvent): string {
  if (e.eversteadOwned) return Colors.gold;
  if (e.provider === "GOOGLE") return "#4285f4";
  if (e.provider === "MICROSOFT") return "#00a4ef";
  return Colors.textSecondary;
}

function providerBg(e: CalendarEvent): string {
  if (e.eversteadOwned) return Colors.goldLight;
  if (e.provider === "GOOGLE") return "#eaf1fd";
  if (e.provider === "MICROSOFT") return "#e3f3fc";
  return Colors.background;
}

function NudgeCard({ nudge }: { nudge: NudgeResponse | undefined }) {
  if (!nudge) return null;
  const { context } = nudge;
  let message = "Sage is here whenever you need a nudge.";

  if (!context.hasTodayPlan) {
    message = "You haven't planned today yet — set 3 priorities to begin.";
  } else if (!context.hasTodayGratitude) {
    message = "Add a gratitude to start your day with intention.";
  } else if (context.todosTotal === 0) {
    message = "Capture a few to-dos so you can move with clarity.";
  } else if (context.todosTotal > 0 && context.todosComplete === 0) {
    message = `${context.todosTotal} to-do${context.todosTotal === 1 ? "" : "s"} on your list — pick one to start.`;
  } else if (context.todosComplete < context.todosTotal) {
    message = `${context.todosComplete}/${context.todosTotal} done. Keep the momentum going.`;
  } else if (context.todosComplete === context.todosTotal && context.todosTotal > 0) {
    message = "Every to-do is checked. Take a breath and celebrate.";
  } else if (context.lastMeditationDaysAgo != null && context.lastMeditationDaysAgo >= 2) {
    message = "It's been a while since your last meditation. A few minutes can reset the day.";
  }

  return (
    <View style={styles.nudgeCard}>
      <View style={styles.nudgeOrb}>
        <Feather name="sun" size={16} color={Colors.gold} />
      </View>
      <View style={styles.nudgeContent}>
        <Text style={styles.nudgeLabel}>Sage</Text>
        <Text style={styles.nudgeMessage}>{message}</Text>
      </View>
    </View>
  );
}

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();
  const { showError } = useToast();
  const queryClient = useQueryClient();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [view, setView] = useState<"day" | "week">("day");

  const dateString = formatDateParam(date);
  const viewingToday = isToday(date);
  const weekStart = useMemo(() => getWeekStart(date), [date]);
  const viewingThisWeek = useMemo(() => isSameWeek(date, new Date()), [date]);

  const dailyQuery = useQuery({
    queryKey: ["planner", "daily", dateString],
    queryFn: () => api.getDailyPlan(dateString),
    retry: 1,
    enabled: view === "day",
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

  const eventsQuery = useQuery({
    queryKey: ["calendar", "events", dateString],
    queryFn: () =>
      api.getCalendarEvents(dayStart.toISOString(), dayEnd.toISOString()),
    retry: 1,
    enabled: view === "day",
  });

  const nudgeQuery = useQuery({
    queryKey: ["coach", "nudge", "Planner", dateString],
    queryFn: () => api.getNudge("Planner"),
    retry: 1,
    enabled: view === "day",
  });

  const dailyPlan: DailyPlanData | undefined = dailyQuery.data;

  const priorities = useMemo(() => {
    const arr = ["", "", ""];
    (dailyPlan?.priorities || []).forEach((p) => {
      if (p.ordinal >= 0 && p.ordinal < 3) arr[p.ordinal] = p.text ?? "";
    });
    return arr;
  }, [dailyPlan]);

  const gratitudes = useMemo(() => {
    return (dailyPlan?.gratitudes || [])
      .filter((g) => g.text && g.text.length > 0)
      .map((g) => ({ id: g.id, ordinal: g.ordinal, text: g.text! }));
  }, [dailyPlan]);

  const todos = dailyPlan?.todos || [];

  const isRefreshing =
    dailyQuery.isRefetching || eventsQuery.isRefetching || nudgeQuery.isRefetching;

  const handleRefresh = useCallback(() => {
    dailyQuery.refetch();
    eventsQuery.refetch();
    nudgeQuery.refetch();
  }, [dailyQuery, eventsQuery, nudgeQuery]);

  const dailyError = dailyQuery.error;
  const eventsError = eventsQuery.error;
  const nudgeError = nudgeQuery.error;

  useEffect(() => {
    if (dailyError) showError(formatLoadError("today's plan", dailyError));
  }, [dailyError, showError]);

  useEffect(() => {
    if (eventsError) showError(formatLoadError("calendar events", eventsError));
  }, [eventsError, showError]);

  useEffect(() => {
    if (nudgeError) showError(formatLoadError("Sage's nudge", nudgeError));
  }, [nudgeError, showError]);

  const invalidatePlan = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["planner", "daily", dateString] });
    queryClient.invalidateQueries({ queryKey: ["coach", "nudge", "Planner", dateString] });
    queryClient.invalidateQueries({ queryKey: ["plan", "today"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
  }, [queryClient, dateString]);

  const goPrev = () => {
    haptic();
    const d = new Date(date);
    d.setDate(d.getDate() - (view === "week" ? 7 : 1));
    setDate(d);
  };

  const goNext = () => {
    haptic();
    const d = new Date(date);
    d.setDate(d.getDate() + (view === "week" ? 7 : 1));
    setDate(d);
  };

  const goToday = () => {
    haptic();
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setDate(d);
  };

  const switchView = (next: "day" | "week") => {
    if (next === view) return;
    haptic();
    setView(next);
  };

  const handleJumpToDay = useCallback((target: Date) => {
    setDate(target);
    setView("day");
  }, []);

  const navAtToday = view === "week" ? viewingThisWeek : viewingToday;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.gold}
          />
        }
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              haptic();
              openDrawer();
            }}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Feather name="menu" size={22} color={Colors.dark} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Planner</Text>
          </View>
          <Pressable
            onPress={goToday}
            disabled={navAtToday}
            style={({ pressed }) => [
              styles.todayBtn,
              navAtToday && { opacity: 0.4 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.todayBtnText}>
              {view === "week" ? "This Week" : "Today"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.viewToggle}>
          <Pressable
            onPress={() => switchView("day")}
            style={({ pressed }) => [
              styles.viewToggleBtn,
              view === "day" && styles.viewToggleBtnActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Feather
              name="sun"
              size={14}
              color={view === "day" ? Colors.dark : Colors.textSecondary}
            />
            <Text
              style={[
                styles.viewToggleText,
                view === "day" && styles.viewToggleTextActive,
              ]}
            >
              Day
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchView("week")}
            style={({ pressed }) => [
              styles.viewToggleBtn,
              view === "week" && styles.viewToggleBtnActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Feather
              name="calendar"
              size={14}
              color={view === "week" ? Colors.dark : Colors.textSecondary}
            />
            <Text
              style={[
                styles.viewToggleText,
                view === "week" && styles.viewToggleTextActive,
              ]}
            >
              Week
            </Text>
          </Pressable>
        </View>

        <View style={styles.dateNav}>
          <Pressable
            onPress={goPrev}
            style={({ pressed }) => [
              styles.dateNavBtn,
              pressed && { opacity: 0.6 },
            ]}
            hitSlop={8}
          >
            <Feather name="chevron-left" size={22} color={Colors.dark} />
          </Pressable>
          <View style={styles.dateNavCenter}>
            <Text style={styles.dateNavText}>
              {view === "week"
                ? formatWeekRange(weekStart)
                : formatHeaderDate(date)}
            </Text>
            {navAtToday ? (
              <View style={styles.todayChip}>
                <Text style={styles.todayChipText}>
                  {view === "week" ? "THIS WEEK" : "TODAY"}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={goNext}
            style={({ pressed }) => [
              styles.dateNavBtn,
              pressed && { opacity: 0.6 },
            ]}
            hitSlop={8}
          >
            <Feather name="chevron-right" size={22} color={Colors.dark} />
          </Pressable>
        </View>

        {view === "week" ? (
          <WeekView weekStart={weekStart} onJumpToDay={handleJumpToDay} />
        ) : dailyQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.gold} />
          </View>
        ) : (
          <>
            <NudgeCard nudge={nudgeQuery.data} />

            <ScheduleSection
              events={eventsQuery.data || []}
              viewingToday={viewingToday}
            />

            <PrioritiesSection
              dailyPlanId={dailyPlan?.id}
              initial={priorities}
              onSaved={invalidatePlan}
            />

            <GratitudesSection
              dailyPlanId={dailyPlan?.id}
              initial={gratitudes}
              onSaved={invalidatePlan}
            />

            <TodoSection
              dailyPlanId={dailyPlan?.id}
              initial={todos}
              onChange={invalidatePlan}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  todayBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  todayBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  dateNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  dateNavCenter: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  dateNavText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  todayChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.goldLight,
  },
  todayChipText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.goldDark,
    letterSpacing: 0.6,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewToggleBtnActive: {
    backgroundColor: Colors.goldLight,
  },
  viewToggleText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  viewToggleTextActive: {
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  priorityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  priorityNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
  },
  priorityNumText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.goldDark,
  },
  priorityInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    paddingVertical: 6,
  },
  gratitudeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  gratitudeSlotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  gratitudeNum: {
    width: 18,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "right",
  },
  gratitudeText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
  },
  gratitudeInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    paddingVertical: 6,
  },
  maxLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    paddingTop: 8,
    paddingLeft: 26,
  },
  deleteBtn: {
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  todoEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
    paddingVertical: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  todoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
  },
  todoTextDone: {
    textDecorationLine: "line-through",
    color: Colors.textSecondary,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.goldLight,
  },
  sourceBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.goldDark,
    letterSpacing: 0.4,
  },
  todoAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
  },
  todoInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  allDayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  allDayChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.background,
    borderRadius: 6,
    borderLeftWidth: 3,
  },
  allDayChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
    maxWidth: 200,
  },
  scheduleGrid: {
    position: "relative",
    marginTop: 4,
  },
  hourRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  hourLabel: {
    width: LEFT_GUTTER,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
    paddingTop: 0,
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.separator,
    marginTop: 6,
  },
  eventBlock: {
    position: "absolute",
    left: LEFT_GUTTER,
    right: 4,
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  eventTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  eventTime: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  nowLine: {
    position: "absolute",
    left: LEFT_GUTTER - 4,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  nowBar: {
    flex: 1,
    height: 1.5,
    backgroundColor: Colors.error,
  },
  scheduleEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
    paddingVertical: 12,
  },
  nudgeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.gold,
    padding: 14,
    marginBottom: 14,
  },
  nudgeOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
  },
  nudgeContent: {
    flex: 1,
    gap: 2,
  },
  nudgeLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.goldDark,
    letterSpacing: 0.6,
  },
  nudgeMessage: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    lineHeight: 19,
  },
});
