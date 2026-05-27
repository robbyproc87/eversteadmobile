import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { api } from "@/lib/api";
import type {
  DailyPlanData,
  DailyPlanTodo,
  WeekData,
} from "@/lib/api";
import PastWeekExceptionalsView from "@/components/planner/PastWeekExceptionalsView";

type WeekTab = "blueprint" | "story" | "past" | "review";

const TABS: Array<{ key: WeekTab; label: string; icon: keyof typeof Feather.glyphMap }> = [
  { key: "blueprint", label: "Blueprint", icon: "compass" },
  { key: "story", label: "Story", icon: "book-open" },
  { key: "past", label: "Past TE", icon: "rotate-ccw" },
  { key: "review", label: "Review", icon: "trending-up" },
];

const RESTRICTED_TABS: WeekTab[] = ["story", "past", "review"];

function isReflectionWindow(d: Date = new Date()): boolean {
  const day = d.getDay();
  return day === 6 || day === 0;
}

function currentFlowPhase(d: Date = new Date()): "blueprint" | "execute" | "reflect" {
  const day = d.getDay();
  if (day === 1 || day === 2) return "blueprint";
  if (day === 6 || day === 0) return "reflect";
  return "execute";
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_NAMES = [
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

function formatDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekDates(weekStart: Date): Date[] {
  const result: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    result.push(d);
  }
  return result;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function haptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
) {
  if (Platform.OS !== "web") Haptics.impactAsync(style);
}

interface WeekViewProps {
  weekStart: Date;
  onJumpToDay?: (date: Date) => void;
}

export default function WeekView({ weekStart, onJumpToDay }: WeekViewProps) {
  const queryClient = useQueryClient();
  const weekStartStr = formatDateParam(weekStart);

  const [tab, setTab] = useState<WeekTab>("blueprint");
  const [earlyUnlock, setEarlyUnlock] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const unlockKey = `planner_early_unlock_${weekStartStr}`;

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setEarlyUnlock(false);
    AsyncStorage.getItem(unlockKey)
      .then((v) => {
        if (!cancelled) {
          setEarlyUnlock(v === "1");
          setHydrated(true);
        }
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [unlockKey]);

  const inReflectionWindow = isReflectionWindow();
  const reflectionUnlocked = inReflectionWindow || earlyUnlock;

  useEffect(() => {
    if (!reflectionUnlocked && RESTRICTED_TABS.includes(tab)) {
      // stay on the tab to show placeholder
    }
  }, [reflectionUnlocked, tab]);

  const handleUnlockEarly = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setEarlyUnlock(true);
    try {
      await AsyncStorage.setItem(unlockKey, "1");
    } catch {
      // best-effort persistence
    }
  }, [unlockKey]);

  const weekQuery = useQuery({
    queryKey: ["planner", "week", weekStartStr],
    queryFn: () => api.getWeek(weekStartStr),
    retry: 1,
  });

  const dailyQuery = useQuery({
    queryKey: ["planner", "daily", weekStartStr],
    queryFn: () => api.getDailyPlan(weekStartStr),
    retry: 1,
  });

  const week = weekQuery.data;
  const daily = dailyQuery.data;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["planner", "week", weekStartStr],
    });
    queryClient.invalidateQueries({
      queryKey: ["planner", "daily", weekStartStr],
    });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
  }, [queryClient, weekStartStr]);

  if (weekQuery.isLoading || dailyQuery.isLoading || !hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  const restricted = RESTRICTED_TABS.includes(tab) && !reflectionUnlocked;

  return (
    <View>
      <WeeklyFlowIndicator activeTab={tab} />

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                haptic();
                setTab(t.key);
              }}
              style={({ pressed }) => [
                styles.tabPill,
                active && styles.tabPillActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Feather
                name={t.icon}
                size={12}
                color={active ? Colors.dark : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabPillText,
                  active && styles.tabPillTextActive,
                ]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {restricted ? (
        <WeeklyReflectionPlaceholder
          tab={tab}
          onUnlock={handleUnlockEarly}
        />
      ) : tab === "blueprint" ? (
        <>
          <TrulyExceptionalsSection
            weekId={week?.id}
            items={week?.trulyExceptionals || []}
            onSaved={invalidate}
          />

          <BlueprintTodosSection
            dailyPlanId={daily?.id}
            todos={(daily?.todos || []).filter((t) => t.source === "wds")}
            onSaved={invalidate}
          />
        </>
      ) : tab === "story" ? (
        <WeeklyStorySection
          weekId={week?.id}
          weekStart={weekStart}
          days={week?.weeklyStoryDays || []}
          observation={week?.weeklyStoryObservation?.content || ""}
          onSaved={invalidate}
          onJumpToDay={onJumpToDay}
        />
      ) : tab === "past" ? (
        <PastWeekExceptionalsView weekStart={weekStart} />
      ) : (
        <WeeklyReviewSection
          weekId={week?.id}
          weekScore={week?.weekScore ?? null}
          insights={week?.weeklyReviewInsights || ""}
          onSaved={invalidate}
        />
      )}
    </View>
  );
}

interface WeeklyFlowIndicatorProps {
  activeTab: WeekTab;
}

function WeeklyFlowIndicator({ activeTab }: WeeklyFlowIndicatorProps) {
  const phase = currentFlowPhase();
  const phases: Array<{
    key: "blueprint" | "execute" | "reflect";
    label: string;
    icon: keyof typeof Feather.glyphMap;
  }> = [
    { key: "blueprint", label: "Plan", icon: "compass" },
    { key: "execute", label: "Live", icon: "zap" },
    { key: "reflect", label: "Reflect", icon: "rotate-ccw" },
  ];

  const labelFor: Record<WeekTab, string> = {
    blueprint: "Set the week's direction.",
    story: "Capture each day as it lived.",
    past: "See what mattered last week.",
    review: "Score the week and learn.",
  };

  return (
    <View style={styles.flowCard}>
      <View style={styles.flowRow}>
        {phases.map((p, i) => {
          const active = phase === p.key;
          return (
            <React.Fragment key={p.key}>
              <View
                style={[
                  styles.flowStep,
                  active && styles.flowStepActive,
                ]}
              >
                <Feather
                  name={p.icon}
                  size={12}
                  color={active ? Colors.dark : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.flowStepText,
                    active && styles.flowStepTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </View>
              {i < phases.length - 1 ? (
                <View style={styles.flowConnector} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
      <Text style={styles.flowHint}>{labelFor[activeTab]}</Text>
    </View>
  );
}

interface WeeklyReflectionPlaceholderProps {
  tab: WeekTab;
  onUnlock: () => void;
}

function WeeklyReflectionPlaceholder({
  tab,
  onUnlock,
}: WeeklyReflectionPlaceholderProps) {
  const titleFor: Record<WeekTab, string> = {
    blueprint: "Weekly Blueprint",
    story: "Weekly Story — unlocks Saturday",
    past: "Last Week's Exceptionals — unlocks Saturday",
    review: "Weekly Reflection — unlocks Saturday",
  };
  const bodyFor: Record<WeekTab, string> = {
    blueprint: "",
    story:
      "Spend the week living your plan. On Saturday, come back to capture how each day unfolded.",
    past:
      "Last week's Truly Exceptionals appear here once the reflection window opens on Saturday.",
    review:
      "On Saturday, you'll rate the week and capture what you learned. Until then, focus on living it.",
  };

  return (
    <View style={styles.placeholderCard}>
      <View style={styles.placeholderIconWrap}>
        <Feather name="lock" size={18} color={Colors.goldDark} />
      </View>
      <Text style={styles.placeholderTitle}>{titleFor[tab]}</Text>
      <Text style={styles.placeholderBody}>{bodyFor[tab]}</Text>
      <Pressable
        onPress={onUnlock}
        style={({ pressed }) => [
          styles.unlockBtn,
          pressed && { opacity: 0.85 },
        ]}
        testID="weekly-unlock-early-btn"
      >
        <Feather name="unlock" size={14} color={Colors.dark} />
        <Text style={styles.unlockBtnText}>Unlock early</Text>
      </Pressable>
    </View>
  );
}

interface SectionHeaderProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  color?: string;
}

function SectionHeader({ icon, title, color = Colors.gold }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIcon, { backgroundColor: Colors.goldLight }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

interface CategoryHeaderProps {
  title: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
}

function CategoryHeader({ title, color, icon }: CategoryHeaderProps) {
  return (
    <View style={styles.categoryHeader}>
      <View style={[styles.categoryDot, { backgroundColor: color }]} />
      <Feather name={icon} size={14} color={color} />
      <Text style={styles.categoryTitle}>{title}</Text>
    </View>
  );
}

interface NumberedInputsProps {
  values: string[];
  onChange: (idx: number, value: string) => void;
  onCommit: () => void;
  placeholder: string;
  testIdPrefix?: string;
}

function NumberedInputs({
  values,
  onChange,
  onCommit,
  placeholder,
}: NumberedInputsProps) {
  return (
    <View style={styles.inputsCol}>
      {values.map((v, i) => (
        <View key={i} style={styles.numberedRow}>
          <View style={styles.numberCircle}>
            <Text style={styles.numberCircleText}>{i + 1}</Text>
          </View>
          <TextInput
            style={styles.numberedInput}
            value={v}
            placeholder={placeholder}
            placeholderTextColor={Colors.textTertiary}
            multiline
            onChangeText={(t) => onChange(i, t)}
            onBlur={onCommit}
            returnKeyType="done"
            blurOnSubmit
          />
        </View>
      ))}
    </View>
  );
}

interface TrulyExceptionalsSectionProps {
  weekId?: string;
  items: WeekData["trulyExceptionals"];
  onSaved: () => void;
}

function TrulyExceptionalsSection({
  weekId,
  items,
  onSaved,
}: TrulyExceptionalsSectionProps) {
  const [personal, setPersonal] = useState<string[]>(["", "", ""]);
  const [professional, setProfessional] = useState<string[]>(["", "", ""]);
  const [inner, setInner] = useState<string[]>(["", "", ""]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const initializedRef = useRef(false);
  const dirtyRef = useRef(false);
  const initialPersonal = useRef<string[]>(["", "", ""]);
  const initialProfessional = useRef<string[]>(["", "", ""]);
  const initialInner = useRef<string[]>(["", "", ""]);

  useEffect(() => {
    if (dirtyRef.current && initializedRef.current) return;

    const p = ["", "", ""];
    const pr = ["", "", ""];
    const inr = ["", "", ""];

    items.forEach((t) => {
      if (t.ordinal < 0 || t.ordinal > 2) return;
      const text = t.text ?? "";
      if (t.category === "personal") p[t.ordinal] = text;
      if (t.category === "professional") pr[t.ordinal] = text;
      if (t.category === "inner") inr[t.ordinal] = text;
    });

    setPersonal(p);
    setProfessional(pr);
    setInner(inr);
    initialPersonal.current = p;
    initialProfessional.current = pr;
    initialInner.current = inr;
    initializedRef.current = true;
  }, [items]);

  const update = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<string[]>>,
      idx: number,
      value: string,
    ) => {
      dirtyRef.current = true;
      setter((prev) => {
        const next = [...prev];
        next[idx] = value;
        return next;
      });
    },
    [],
  );

  const commit = useCallback(async () => {
    if (!weekId) return;
    if (!dirtyRef.current) return;

    const samePersonal =
      personal.every((v, i) => v === initialPersonal.current[i]) &&
      personal.length === initialPersonal.current.length;
    const sameProf =
      professional.every((v, i) => v === initialProfessional.current[i]) &&
      professional.length === initialProfessional.current.length;
    const sameInner =
      inner.every((v, i) => v === initialInner.current[i]) &&
      inner.length === initialInner.current.length;

    if (samePersonal && sameProf && sameInner) {
      dirtyRef.current = false;
      return;
    }

    const payload = [
      ...personal.map((text, ordinal) => ({
        category: "personal",
        ordinal,
        text,
        source: "review_set",
      })),
      ...professional.map((text, ordinal) => ({
        category: "professional",
        ordinal,
        text,
        source: "review_set",
      })),
      ...inner.map((text, ordinal) => ({
        category: "inner",
        ordinal,
        text,
        source: "review_set",
      })),
    ];

    setSaving(true);
    try {
      await api.saveTrulyExceptionals(weekId, payload);
      initialPersonal.current = personal;
      initialProfessional.current = professional;
      initialInner.current = inner;
      dirtyRef.current = false;
      setSavedAt(Date.now());
      onSaved();
    } catch {
      // swallow; stay dirty so next blur retries
    } finally {
      setSaving(false);
    }
  }, [weekId, personal, professional, inner, onSaved]);

  const showSaved = savedAt !== null && Date.now() - savedAt < 2000;

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeaderRow}>
        <SectionHeader icon="star" title="Truly Exceptionals" />
        {saving ? (
          <Text style={styles.savingText}>Saving…</Text>
        ) : showSaved ? (
          <Text style={styles.savedText}>Saved</Text>
        ) : null}
      </View>

      <View style={styles.promptBlock}>
        <Text style={styles.promptText}>
          What 3 things must happen this week for you to feel it was very
          successful?
        </Text>
      </View>

      <View style={styles.categoryGroup}>
        <CategoryHeader title="Personal" color="#5b8def" icon="star" />
        <NumberedInputs
          values={personal}
          onChange={(i, v) => update(setPersonal, i, v)}
          onCommit={commit}
          placeholder="Set a personal goal"
        />
      </View>

      <View style={styles.categoryGroup}>
        <CategoryHeader
          title="Professional"
          color={Colors.goldDark}
          icon="briefcase"
        />
        <NumberedInputs
          values={professional}
          onChange={(i, v) => update(setProfessional, i, v)}
          onCommit={commit}
          placeholder="Set a professional goal"
        />
      </View>

      <View style={styles.categoryGroup}>
        <CategoryHeader title="Inner" color="#a78bfa" icon="heart" />
        <NumberedInputs
          values={inner}
          onChange={(i, v) => update(setInner, i, v)}
          onCommit={commit}
          placeholder="e.g., Daily stillness, Gratitude"
        />
      </View>
    </View>
  );
}

interface WeeklyStorySectionProps {
  weekId?: string;
  weekStart: Date;
  days: WeekData["weeklyStoryDays"];
  observation: string;
  onSaved: () => void;
  onJumpToDay?: (date: Date) => void;
}

function WeeklyStorySection({
  weekId,
  weekStart,
  days,
  observation,
  onSaved,
  onJumpToDay,
}: WeeklyStorySectionProps) {
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [narratives, setNarratives] = useState<string[]>(Array(7).fill(""));
  const [obs, setObs] = useState("");
  const [collapsed, setCollapsed] = useState<boolean[]>(() =>
    weekDates.map((d) => !isSameDay(d, today) && d > today),
  );
  const [savingNarr, setSavingNarr] = useState(false);
  const [savingObs, setSavingObs] = useState(false);
  const [suggestingIdx, setSuggestingIdx] = useState<number | null>(null);
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const dirtyNarrativesRef = useRef(false);
  const dirtyObsRef = useRef(false);
  const initialNarratives = useRef<string[]>(Array(7).fill(""));
  const initialObs = useRef("");

  useEffect(() => {
    if (dirtyNarrativesRef.current && initializedRef.current) return;
    const n = Array(7).fill("");
    days.forEach((d) => {
      if (d.dayOfWeek >= 0 && d.dayOfWeek < 7) {
        n[d.dayOfWeek] = d.narrative ?? "";
      }
    });
    setNarratives(n);
    initialNarratives.current = n;
  }, [days]);

  useEffect(() => {
    if (dirtyObsRef.current && initializedRef.current) return;
    setObs(observation);
    initialObs.current = observation;
    initializedRef.current = true;
  }, [observation]);

  const updateNarrative = useCallback((idx: number, value: string) => {
    dirtyNarrativesRef.current = true;
    setNarratives((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  const commitNarratives = useCallback(async () => {
    if (!weekId || !dirtyNarrativesRef.current) return;
    const same = narratives.every(
      (v, i) => v === initialNarratives.current[i],
    );
    if (same) {
      dirtyNarrativesRef.current = false;
      return;
    }
    setSavingNarr(true);
    try {
      await api.saveWeeklyStory(
        weekId,
        narratives.map((narrative, dayOfWeek) => ({
          dayOfWeek,
          narrative,
        })),
      );
      initialNarratives.current = narratives;
      dirtyNarrativesRef.current = false;
      onSaved();
    } catch {
      // swallow
    } finally {
      setSavingNarr(false);
    }
  }, [weekId, narratives, onSaved]);

  const commitObs = useCallback(async () => {
    if (!weekId || !dirtyObsRef.current) return;
    if (obs === initialObs.current) {
      dirtyObsRef.current = false;
      return;
    }
    setSavingObs(true);
    try {
      await api.saveWeeklyObservation(weekId, obs);
      initialObs.current = obs;
      dirtyObsRef.current = false;
      onSaved();
    } catch {
      // swallow
    } finally {
      setSavingObs(false);
    }
  }, [weekId, obs, onSaved]);

  const handleSuggest = useCallback(
    async (idx: number, date: Date) => {
      if (!weekId || suggestingIdx !== null) return;
      haptic();
      setSuggestingIdx(idx);
      setSuggestMsg(null);
      try {
        const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const res = await api.suggestWeekStory(weekId, isoDate);
        if (res?.suggestion && res.suggestion.trim()) {
          dirtyNarrativesRef.current = true;
          setNarratives((prev) => {
            const next = [...prev];
            const existing = next[idx] || "";
            next[idx] = existing
              ? `${existing.trimEnd()}\n\n${res.suggestion}`
              : res.suggestion!;
            return next;
          });
        } else {
          setSuggestMsg(
            res?.message ||
              "Nothing to draft from yet — add a journal entry or plan for this day.",
          );
        }
      } catch {
        setSuggestMsg("Couldn't draft a suggestion. Please try again.");
      } finally {
        setSuggestingIdx(null);
      }
    },
    [weekId, suggestingIdx],
  );

  const toggleCollapse = useCallback((idx: number) => {
    haptic();
    setCollapsed((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  }, []);

  const saving = savingNarr || savingObs;

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeaderRow}>
        <SectionHeader icon="book-open" title="Weekly Story" />
        {saving ? <Text style={styles.savingText}>Saving…</Text> : null}
      </View>

      {weekDates.map((date, i) => {
        const isCollapsed = collapsed[i];
        const hasContent = (narratives[i] || "").length > 0;
        const preview = hasContent
          ? narratives[i].slice(0, 90) + (narratives[i].length > 90 ? "…" : "")
          : "";
        const isCurrentDay = isSameDay(date, today);

        return (
          <View
            key={i}
            style={[
              styles.storyDay,
              isCurrentDay && styles.storyDayToday,
            ]}
          >
            <Pressable
              onPress={() => toggleCollapse(i)}
              style={({ pressed }) => [
                styles.storyHeader,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Feather
                name={isCollapsed ? "chevron-right" : "chevron-down"}
                size={16}
                color={Colors.textSecondary}
              />
              <Text style={styles.storyDayLabel}>
                {FULL_DAY_NAMES[i]}, {MONTH_NAMES[date.getMonth()]}{" "}
                {date.getDate()}
              </Text>
              {isCurrentDay ? (
                <View style={styles.todayPill}>
                  <Text style={styles.todayPillText}>TODAY</Text>
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              {onJumpToDay ? (
                <Pressable
                  onPress={() => {
                    haptic();
                    onJumpToDay(date);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.jumpBtn,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Feather
                    name="external-link"
                    size={14}
                    color={Colors.textSecondary}
                  />
                </Pressable>
              ) : null}
            </Pressable>

            {isCollapsed ? (
              hasContent ? (
                <Pressable onPress={() => toggleCollapse(i)}>
                  <Text style={styles.storyPreview} numberOfLines={2}>
                    {preview}
                  </Text>
                </Pressable>
              ) : null
            ) : (
              <>
                <TextInput
                  style={styles.storyTextarea}
                  value={narratives[i]}
                  onChangeText={(t) => updateNarrative(i, t)}
                  onBlur={commitNarratives}
                  placeholder="How did you live this day?"
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  textAlignVertical="top"
                />
                <View style={styles.suggestRow}>
                  <Pressable
                    onPress={() => handleSuggest(i, date)}
                    disabled={!weekId || suggestingIdx !== null}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.suggestBtn,
                      (!weekId || suggestingIdx !== null) && { opacity: 0.5 },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    {suggestingIdx === i ? (
                      <ActivityIndicator size="small" color={Colors.gold} />
                    ) : (
                      <>
                        <Feather
                          name="zap"
                          size={12}
                          color={Colors.goldDark}
                        />
                        <Text style={styles.suggestBtnText}>Suggest</Text>
                      </>
                    )}
                  </Pressable>
                  {suggestMsg && suggestingIdx === null ? (
                    <Text style={styles.suggestHint} numberOfLines={2}>
                      {suggestMsg}
                    </Text>
                  ) : null}
                </View>
              </>
            )}
          </View>
        );
      })}

      <View style={styles.observationBlock}>
        <Text style={styles.observationLabel}>Observations</Text>
        <TextInput
          style={styles.observationTextarea}
          value={obs}
          onChangeText={(t) => {
            dirtyObsRef.current = true;
            setObs(t);
          }}
          onBlur={commitObs}
          placeholder="What patterns did you notice this week? What surprised you?"
          placeholderTextColor={Colors.textTertiary}
          multiline
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

interface WeeklyReviewSectionProps {
  weekId?: string;
  weekScore: number | null;
  insights: string;
  onSaved: () => void;
}

function WeeklyReviewSection({
  weekId,
  weekScore,
  insights,
  onSaved,
}: WeeklyReviewSectionProps) {
  const [score, setScore] = useState<number | null>(weekScore);
  const [text, setText] = useState(insights);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirtyScoreRef = useRef(false);
  const dirtyTextRef = useRef(false);
  const initialScoreRef = useRef<number | null>(weekScore);
  const initialTextRef = useRef<string>(insights);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (dirtyScoreRef.current && initializedRef.current) return;
    setScore(weekScore);
    initialScoreRef.current = weekScore;
  }, [weekScore]);

  useEffect(() => {
    if (dirtyTextRef.current && initializedRef.current) return;
    setText(insights);
    initialTextRef.current = insights;
    initializedRef.current = true;
  }, [insights]);

  const commit = useCallback(
    async (nextScore: number | null, nextText: string) => {
      if (!weekId) return;
      const scoreChanged = nextScore !== initialScoreRef.current;
      const textChanged = nextText !== initialTextRef.current;
      if (!scoreChanged && !textChanged) return;

      setSaving(true);
      try {
        await api.updateWeek(weekId, {
          weekScore: nextScore,
          weeklyReviewInsights: nextText,
        });
        initialScoreRef.current = nextScore;
        initialTextRef.current = nextText;
        dirtyScoreRef.current = false;
        dirtyTextRef.current = false;
        setSavedAt(Date.now());
        onSaved();
      } catch {
        // swallow
      } finally {
        setSaving(false);
      }
    },
    [weekId, onSaved],
  );

  const handleScoreChange = useCallback(
    (newScore: number) => {
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      dirtyScoreRef.current = true;
      setScore(newScore);
      // commit immediately for score taps
      commit(newScore, text);
    },
    [commit, text],
  );

  const showSaved = savedAt !== null && Date.now() - savedAt < 2000;

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeaderRow}>
        <SectionHeader icon="trending-up" title="Weekly Review" />
        {saving ? (
          <Text style={styles.savingText}>Saving…</Text>
        ) : showSaved ? (
          <Text style={styles.savedText}>Saved</Text>
        ) : null}
      </View>

      <Text style={styles.subLabel}>Weekly Score</Text>
      <ScoreSelector value={score} onChange={handleScoreChange} />

      <Text style={[styles.subLabel, { marginTop: 18 }]}>Insights & Notes</Text>
      <TextInput
        style={styles.insightsTextarea}
        value={text}
        onChangeText={(t) => {
          dirtyTextRef.current = true;
          setText(t);
        }}
        onBlur={() => commit(score, text)}
        placeholder="What worked this week? What didn't? What will you do differently?"
        placeholderTextColor={Colors.textTertiary}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

interface ScoreSelectorProps {
  value: number | null;
  onChange: (n: number) => void;
}

function getScoreColor(n: number | null): string {
  if (n === null) return Colors.textTertiary;
  if (n <= 3) return "#d4534a";
  if (n <= 6) return "#e6a23c";
  if (n <= 8) return "#5b8def";
  return "#4a9c6d";
}

function ScoreSelector({ value, onChange }: ScoreSelectorProps) {
  const display = value ?? 5;
  const interacted = value !== null;
  const color = interacted ? getScoreColor(display) : Colors.textTertiary;

  return (
    <View style={styles.scoreContainer}>
      <Text style={[styles.scoreNumber, { color }]}>{display}</Text>
      <View style={styles.scoreDots}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = interacted && n <= display;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={({ pressed }) => [
                styles.scoreDot,
                {
                  backgroundColor: active ? color : Colors.background,
                  borderColor: active ? color : Colors.cardBorder,
                },
                pressed && { transform: [{ scale: 0.92 }] },
              ]}
              hitSlop={4}
            >
              <Text
                style={[
                  styles.scoreDotText,
                  { color: active ? Colors.white : Colors.textTertiary },
                ]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.scoreLabels}>
        <Text style={styles.scoreLabelText}>Mediocre</Text>
        <Text style={styles.scoreLabelText}>Solid</Text>
        <Text style={styles.scoreLabelText}>World Class</Text>
      </View>
    </View>
  );
}

interface BlueprintTodosSectionProps {
  dailyPlanId?: string;
  todos: DailyPlanTodo[];
  onSaved: () => void;
}

function BlueprintTodosSection({
  dailyPlanId,
  todos,
  onSaved,
}: BlueprintTodosSectionProps) {
  const [items, setItems] = useState<DailyPlanTodo[]>(todos);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setItems(todos);
  }, [todos]);

  const handleAdd = useCallback(async () => {
    const text = draft.trim();
    if (!text || !dailyPlanId) return;
    setAdding(true);
    const optimisticId = `tmp_${Date.now()}`;
    const optimistic: DailyPlanTodo = {
      id: optimisticId,
      text,
      completed: false,
      ordinal: items.length,
      source: "wds",
    };
    setItems((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      const created = await api.addTodo(dailyPlanId, text, "wds");
      setItems((prev) =>
        prev.map((t) => (t.id === optimisticId ? created : t)),
      );
      onSaved();
    } catch {
      setItems((prev) => prev.filter((t) => t.id !== optimisticId));
      setDraft(text);
    } finally {
      setAdding(false);
    }
  }, [draft, dailyPlanId, items.length, onSaved]);

  const handleToggle = useCallback(
    async (todo: DailyPlanTodo) => {
      if (todo.id.startsWith("tmp_")) return;
      haptic();
      const snapshot = items;
      setItems((prev) =>
        prev.map((t) =>
          t.id === todo.id ? { ...t, completed: !t.completed } : t,
        ),
      );
      try {
        await api.updateTodo(todo.id, { completed: !todo.completed });
        onSaved();
      } catch {
        setItems(snapshot);
      }
    },
    [items, onSaved],
  );

  const handleDelete = useCallback(
    async (todo: DailyPlanTodo) => {
      if (todo.id.startsWith("tmp_")) return;
      haptic();
      const snapshot = items;
      setItems((prev) => prev.filter((t) => t.id !== todo.id));
      try {
        await api.deleteTodo(todo.id);
        onSaved();
      } catch {
        setItems(snapshot);
      }
    },
    [items, onSaved],
  );

  return (
    <View style={styles.card}>
      <SectionHeader icon="check-square" title="To-Dos / Deliverables" />

      {items.length === 0 ? (
        <Text style={styles.emptyText}>
          No weekly to-dos yet. Add deliverables that move the week forward.
        </Text>
      ) : (
        items.map((todo) => (
          <View key={todo.id} style={styles.todoRow}>
            <Pressable
              onPress={() => handleToggle(todo)}
              style={[
                styles.checkbox,
                todo.completed && styles.checkboxChecked,
              ]}
              hitSlop={8}
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
            <Pressable
              onPress={() => handleDelete(todo)}
              style={styles.deleteBtn}
              hitSlop={6}
            >
              <Feather name="x" size={16} color={Colors.textTertiary} />
            </Pressable>
          </View>
        ))
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a weekly deliverable…"
          placeholderTextColor={Colors.textTertiary}
          editable={!!dailyPlanId && !adding}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable
          onPress={handleAdd}
          disabled={!draft.trim() || !dailyPlanId || adding}
          style={({ pressed }) => [
            styles.addBtn,
            (!draft.trim() || !dailyPlanId || adding) && { opacity: 0.5 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="plus" size={20} color={Colors.dark} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: 60,
    alignItems: "center",
  },
  flowCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  flowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  flowStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  flowStepActive: {
    backgroundColor: Colors.goldLight,
  },
  flowStepText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  flowStepTextActive: {
    color: Colors.dark,
  },
  flowConnector: {
    width: 18,
    height: 1,
    backgroundColor: Colors.cardBorder,
  },
  flowHint: {
    marginTop: 6,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  tabPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  tabPillActive: {
    backgroundColor: Colors.goldLight,
  },
  tabPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  tabPillTextActive: {
    color: Colors.dark,
    fontFamily: "Inter_700Bold",
  },
  placeholderCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: "dashed",
    padding: 24,
    alignItems: "center",
    marginBottom: 14,
  },
  placeholderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  placeholderTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    textAlign: "center",
    marginBottom: 6,
  },
  placeholderBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  unlockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.goldLight,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  unlockBtnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    letterSpacing: 0.3,
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
    marginBottom: 12,
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
  savingText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  savedText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.success,
  },
  promptBlock: {
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold,
    marginBottom: 16,
  },
  promptText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  categoryGroup: {
    marginBottom: 14,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    letterSpacing: 0.2,
  },
  inputsCol: {
    gap: 6,
  },
  numberedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 4,
  },
  numberCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },
  numberCircleText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.goldDark,
  },
  numberedInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    paddingVertical: 6,
    minHeight: 32,
  },
  storyDay: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  storyDayToday: {
    backgroundColor: Colors.goldLight + "40",
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderTopColor: Colors.gold,
  },
  storyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  storyDayLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  todayPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: Colors.gold,
    marginLeft: 4,
  },
  todayPillText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    letterSpacing: 0.5,
  },
  jumpBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  storyPreview: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    fontStyle: "italic",
    paddingTop: 6,
    paddingLeft: 22,
  },
  storyTextarea: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    minHeight: 90,
  },
  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  suggestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.gold,
    backgroundColor: Colors.goldLight,
  },
  suggestBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
  },
  suggestHint: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  observationBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
  },
  observationLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    marginBottom: 8,
  },
  observationTextarea: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
    minHeight: 110,
  },
  subLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  scoreContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  scoreNumber: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    lineHeight: 52,
  },
  scoreDots: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  scoreDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreDotText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  scoreLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignSelf: "stretch",
    paddingHorizontal: 4,
    marginTop: 4,
  },
  scoreLabelText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
  },
  insightsTextarea: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    minHeight: 140,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
    paddingVertical: 14,
  },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
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
  deleteBtn: {
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
  },
  addInput: {
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
});
