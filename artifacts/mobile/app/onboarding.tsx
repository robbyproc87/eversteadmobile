import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";

type OnboardingType = "quick" | "deep";

interface HealthData {
  sleep: number;
  exercise: number;
  nutrition: number;
  energy: number;
}

interface OnboardingData {
  topGoals: string[];
  biggestChallenge: string;
  focusAreas: string[];
  lifeRating: number | null;
  coachingStyle: number;
  whyGrowing: string;
  routineRating: number | null;
  healthSnapshot: HealthData;
  learningStyle: string | null;
  accountability: string | null;
}

const DEFAULT_DATA: OnboardingData = {
  topGoals: ["", "", ""],
  biggestChallenge: "",
  focusAreas: ["mindset", "professional", "health", "mindfulness", "creativity"],
  lifeRating: null,
  coachingStyle: 50,
  whyGrowing: "",
  routineRating: null,
  healthSnapshot: { sleep: 0, exercise: 0, nutrition: 0, energy: 0 },
  learningStyle: null,
  accountability: null,
};

const QUICK_STEPS = ["topGoals", "biggestChallenge", "focusAreas", "lifeRating", "coachingStyle"] as const;
const DEEP_STEPS = [
  ...QUICK_STEPS,
  "whyGrowing",
  "routineRating",
  "healthSnapshot",
  "learningStyle",
  "accountability",
] as const;

function haptic(s: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(s);
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { showError } = useToast();

  const [type, setType] = useState<OnboardingType | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    (async () => {
      try {
        const st = await api.getOnboardingState();
        if (st?.onboardingComplete) {
          router.replace("/(tabs)");
          return;
        }
        if (st?.onboardingProgress && st?.onboardingType) {
          setData({ ...DEFAULT_DATA, ...(st.onboardingProgress as Partial<OnboardingData>) });
          setType(st.onboardingType);
          setStepIndex(typeof st.onboardingResumeAt === "number" ? st.onboardingResumeAt : 0);
        }
      } catch {
        // ignore — show type picker
      } finally {
        setLoaded(true);
      }
    })();
  }, [router]);

  const steps = type === "deep" ? DEEP_STEPS : type === "quick" ? QUICK_STEPS : [];
  const currentStep = steps[stepIndex];
  const total = steps.length;
  const progressPct = total > 0 ? ((stepIndex + 1) / total) * 100 : 0;

  const updateField = useCallback(<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((p) => ({ ...p, [key]: value }));
  }, []);

  const persistPartial = useCallback(
    async (idx: number) => {
      if (!type) return;
      try {
        await api.saveOnboardingPartial(dataRef.current as unknown as Record<string, unknown>, type, idx);
      } catch {
        // silent — best-effort
      }
    },
    [type],
  );

  const canAdvance = useMemo(() => {
    if (!currentStep) return false;
    switch (currentStep) {
      case "topGoals":
        return data.topGoals.some((g) => g.trim().length > 0);
      case "biggestChallenge":
        return data.biggestChallenge.trim().length > 0;
      case "focusAreas":
        return data.focusAreas.length === 5;
      case "lifeRating":
        return data.lifeRating !== null;
      case "coachingStyle":
        return true;
      case "whyGrowing":
        return data.whyGrowing.trim().length > 0;
      case "routineRating":
        return data.routineRating !== null;
      case "healthSnapshot":
        return Object.values(data.healthSnapshot).every((v) => v > 0);
      case "learningStyle":
        return !!data.learningStyle;
      case "accountability":
        return !!data.accountability;
    }
    return false;
  }, [currentStep, data]);

  const handleNext = useCallback(async () => {
    if (!type) return;
    haptic();
    if (stepIndex >= total - 1) {
      // submit
      setSubmitting(true);
      try {
        const payload = {
          topGoals: data.topGoals.filter((g) => g.trim()),
          biggestChallenge: data.biggestChallenge,
          focusAreas: data.focusAreas,
          lifeRating: data.lifeRating,
          coachingStyle: data.coachingStyle,
          ...(type === "deep" && {
            whyGrowing: data.whyGrowing,
            routineRating: data.routineRating,
            healthSnapshot: data.healthSnapshot,
            learningStyle: data.learningStyle,
            accountability: data.accountability,
          }),
        };
        await api.saveOnboarding(payload, type);
        qc.invalidateQueries({ queryKey: ["onboarding"] });
        qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
        router.replace("/(tabs)");
      } catch (e) {
        showError(e instanceof Error ? e.message : "Couldn't finish onboarding. Please try again.");
        setSubmitting(false);
      }
      return;
    }
    const next = stepIndex + 1;
    setStepIndex(next);
    persistPartial(next);
  }, [type, stepIndex, total, data, qc, router, showError, persistPartial]);

  const handleBack = useCallback(() => {
    if (stepIndex === 0) {
      setType(null);
      return;
    }
    haptic();
    setStepIndex((i) => Math.max(0, i - 1));
  }, [stepIndex]);

  if (!loaded) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  if (!type) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.welcomeIcon}>
            <Feather name="compass" size={28} color={Colors.gold} />
          </View>
          <Text style={styles.welcomeTitle}>Welcome to Everstead</Text>
          <Text style={styles.welcomeSub}>
            We&apos;ll learn a bit about you so your coaches can give you the right guidance.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.typeCard, styles.typeCardPrimary, pressed && { opacity: 0.9 }]}
            onPress={() => {
              haptic();
              setType("quick");
            }}
          >
            <Text style={styles.typeTitle}>Quick start</Text>
            <Text style={styles.typeDesc}>5 questions, about 2 minutes. You can deepen your profile later.</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.typeCard, pressed && { opacity: 0.9 }]}
            onPress={() => {
              haptic();
              setType("deep");
            }}
          >
            <Text style={styles.typeTitle}>Deep profile</Text>
            <Text style={styles.typeDesc}>10 questions, about 5 minutes. Best for personalized coaching.</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.topBtn, pressed && { opacity: 0.6 }]}
          hitSlop={10}
        >
          <Feather name="chevron-left" size={22} color={Colors.dark} />
        </Pressable>
        <Text style={styles.topCounter}>
          {stepIndex + 1} of {total}
        </Text>
        <View style={styles.topBtn} />
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
      >
        <ScrollView contentContainerStyle={styles.stepScroll} keyboardShouldPersistTaps="handled">
          <StepBody data={data} step={currentStep!} update={updateField} />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleNext}
            disabled={!canAdvance || submitting}
            style={({ pressed }) => [
              styles.nextBtn,
              (!canAdvance || submitting) && { opacity: 0.4 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.nextText}>
                {stepIndex >= total - 1 ? "Finish" : "Continue"}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

interface StepBodyProps {
  step: string;
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}

function StepBody({ step, data, update }: StepBodyProps) {
  switch (step) {
    case "topGoals":
      return <TopGoalsStep value={data.topGoals} onChange={(v) => update("topGoals", v)} />;
    case "biggestChallenge":
      return <TextAreaStep title="What's the biggest thing you're navigating in your life right now?" placeholder="Be honest — it helps us help you." value={data.biggestChallenge} onChange={(v) => update("biggestChallenge", v)} />;
    case "focusAreas":
      return <FocusAreasStep value={data.focusAreas} onChange={(v) => update("focusAreas", v)} />;
    case "lifeRating":
      return <RatingStep title="On a scale of 1 to 10, how would you rate your overall satisfaction with your life?" lowLabel="Struggling" highLabel="Thriving" value={data.lifeRating} onChange={(v) => update("lifeRating", v)} />;
    case "coachingStyle":
      return <CoachingStyleStep value={data.coachingStyle} onChange={(v) => update("coachingStyle", v)} />;
    case "whyGrowing":
      return <TextAreaStep title="Why do you want to grow? What's driving you to invest in yourself right now?" placeholder="Your 'why' is the fuel for everything else." value={data.whyGrowing} onChange={(v) => update("whyGrowing", v)} />;
    case "routineRating":
      return <RatingStep title="How would you rate your current daily routine?" lowLabel="Nonexistent" highLabel="Dialed in" value={data.routineRating} onChange={(v) => update("routineRating", v)} />;
    case "healthSnapshot":
      return <HealthSnapshotStep value={data.healthSnapshot} onChange={(v) => update("healthSnapshot", v)} />;
    case "learningStyle":
      return <ChoiceStep title="How do you learn best?" value={data.learningStyle} onChange={(v) => update("learningStyle", v)} options={[
        { key: "reading", emoji: "📖", label: "Reading", description: "I absorb ideas through books and articles" },
        { key: "doing", emoji: "🛠️", label: "Doing", description: "I learn by trying things and experimenting" },
        { key: "discussing", emoji: "💬", label: "Discussing", description: "I understand things by talking them through" },
        { key: "watching", emoji: "🎥", label: "Watching", description: "I prefer videos, courses, and demonstrations" },
      ]} />;
    case "accountability":
      return <ChoiceStep title="When you're falling short of a commitment, what helps most?" value={data.accountability} onChange={(v) => update("accountability", v)} options={[
        { key: "celebrate-wins", emoji: "🎉", label: "Celebrate my wins", description: "Focus on what I did right" },
        { key: "call-me-out", emoji: "📢", label: "Call me out", description: "Be direct about what I missed" },
        { key: "ask-questions", emoji: "❓", label: "Ask me questions", description: "Help me figure it out" },
        { key: "mix", emoji: "🔀", label: "Mix it up", description: "Whatever fits the moment" },
      ]} />;
    default:
      return null;
  }
}

function TopGoalsStep({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const goals = [...value];
  while (goals.length < 3) goals.push("");
  const placeholders = ["e.g., Get promoted at work", "e.g., Build a morning routine", "e.g., Read 12 books"];
  return (
    <>
      <Text style={styles.stepTitle}>
        If you could accomplish just 3 things in the next 90 days, what would they be?
      </Text>
      {goals.map((g, i) => (
        <View key={i} style={styles.numberedRow}>
          <Text style={styles.numLabel}>{i + 1}</Text>
          <TextInput
            value={g}
            onChangeText={(t) => {
              const next = [...goals];
              next[i] = t;
              onChange(next);
            }}
            placeholder={placeholders[i]}
            placeholderTextColor={Colors.textTertiary}
            style={styles.input}
          />
        </View>
      ))}
      <Text style={styles.hint}>At least 1 goal is required. Goals 2 and 3 are optional.</Text>
    </>
  );
}

function TextAreaStep({ title, placeholder, value, onChange }: { title: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <>
      <Text style={styles.stepTitle}>{title}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        multiline
        textAlignVertical="top"
        style={styles.textarea}
      />
    </>
  );
}

const FOCUS_ITEMS: Record<string, { emoji: string; label: string; description: string }> = {
  mindset: { emoji: "🧠", label: "Mindset & Purpose", description: "Clarity, goals, growth" },
  professional: { emoji: "💼", label: "Professional & Financial", description: "Career, business, money" },
  health: { emoji: "💪", label: "Health & Energy", description: "Fitness, sleep, nutrition" },
  mindfulness: { emoji: "🧘", label: "Mindfulness & Peace", description: "Meditation, stress, emotion" },
  creativity: { emoji: "🎨", label: "Creativity & Learning", description: "Reading, skills, expression" },
};

function FocusAreasStep({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const items = value.length === 5 ? value : Object.keys(FOCUS_ITEMS);
  const move = (i: number, dir: -1 | 1) => {
    const ni = i + dir;
    if (ni < 0 || ni >= items.length) return;
    const next = [...items];
    [next[i], next[ni]] = [next[ni], next[i]];
    onChange(next);
  };
  return (
    <>
      <Text style={styles.stepTitle}>Rank these areas in the order that matters most right now:</Text>
      <Text style={styles.subTitle}>Use the arrows to reorder. #1 = most important.</Text>
      {items.map((key, i) => {
        const item = FOCUS_ITEMS[key];
        return (
          <View key={key} style={styles.focusRow}>
            <Text style={styles.focusRank}>{i + 1}</Text>
            <Text style={styles.focusEmoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.focusLabel}>{item.label}</Text>
              <Text style={styles.focusDesc}>{item.description}</Text>
            </View>
            <View>
              <Pressable
                disabled={i === 0}
                onPress={() => {
                  haptic();
                  move(i, -1);
                }}
                style={({ pressed }) => [styles.arrowBtn, i === 0 && { opacity: 0.2 }, pressed && { opacity: 0.5 }]}
              >
                <Feather name="chevron-up" size={16} color={Colors.dark} />
              </Pressable>
              <Pressable
                disabled={i === items.length - 1}
                onPress={() => {
                  haptic();
                  move(i, 1);
                }}
                style={({ pressed }) => [styles.arrowBtn, i === items.length - 1 && { opacity: 0.2 }, pressed && { opacity: 0.5 }]}
              >
                <Feather name="chevron-down" size={16} color={Colors.dark} />
              </Pressable>
            </View>
          </View>
        );
      })}
    </>
  );
}

function ratingColor(n: number | null): string {
  if (n === null) return Colors.textTertiary;
  if (n <= 3) return "#d4534a";
  if (n <= 6) return "#e6a23c";
  if (n <= 8) return "#5b8def";
  return "#4a9c6d";
}

function RatingStep({ title, lowLabel, highLabel, value, onChange }: { title: string; lowLabel: string; highLabel: string; value: number | null; onChange: (n: number) => void }) {
  const display = value ?? 5;
  const interacted = value !== null;
  const color = interacted ? ratingColor(display) : Colors.textTertiary;
  return (
    <>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={[styles.ratingDisplay, { color }]}>{display}</Text>
      <View style={styles.dotRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = interacted && n <= display;
          return (
            <Pressable
              key={n}
              onPress={() => {
                haptic(Haptics.ImpactFeedbackStyle.Medium);
                onChange(n);
              }}
              style={({ pressed }) => [
                styles.dot,
                { backgroundColor: active ? color : Colors.background, borderColor: active ? color : Colors.cardBorder },
                pressed && { opacity: 0.6 },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.dotLabels}>
        <Text style={styles.dotLabel}>{lowLabel}</Text>
        <Text style={styles.dotLabel}>{highLabel}</Text>
      </View>
    </>
  );
}

function CoachingStyleStep({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const preview =
    value <= 25 ? "We'll be gentle. Think of us as a supportive friend who believes in you." :
    value <= 50 ? "We'll encourage you and nudge you forward when you need it." :
    value <= 75 ? "We'll be honest with you and push you toward your commitments." :
    "No excuses. We'll hold you accountable and expect your best.";

  return (
    <>
      <Text style={styles.stepTitle}>How would you like your coaches to communicate with you?</Text>
      <View style={styles.styleDotRow}>
        {[0, 25, 50, 75, 100].map((v) => {
          const active = value === v;
          return (
            <Pressable
              key={v}
              onPress={() => {
                haptic();
                onChange(v);
              }}
              style={({ pressed }) => [
                styles.styleDot,
                active && { backgroundColor: Colors.gold, borderColor: Colors.gold },
                pressed && { opacity: 0.6 },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.styleLabels}>
        <Text style={styles.dotLabel}>Gentle</Text>
        <Text style={styles.dotLabel}>Balanced</Text>
        <Text style={styles.dotLabel}>Direct</Text>
      </View>
      <View style={styles.previewBox}>
        <Text style={styles.previewText}>{preview}</Text>
      </View>
    </>
  );
}

const PILLARS: { key: keyof HealthData; emoji: string; label: string; low: string; high: string }[] = [
  { key: "sleep", emoji: "😴", label: "Sleep", low: "Terrible", high: "Excellent" },
  { key: "exercise", emoji: "🏃", label: "Exercise", low: "Sedentary", high: "Very active" },
  { key: "nutrition", emoji: "🥗", label: "Nutrition", low: "Poor", high: "Excellent" },
  { key: "energy", emoji: "⚡", label: "Energy", low: "Exhausted", high: "Energized" },
];

function HealthSnapshotStep({ value, onChange }: { value: HealthData; onChange: (v: HealthData) => void }) {
  return (
    <>
      <Text style={styles.stepTitle}>Rate these four pillars of your physical wellbeing:</Text>
      {PILLARS.map(({ key, emoji, label, low, high }) => (
        <View key={key} style={styles.pillar}>
          <View style={styles.pillarHeader}>
            <Text style={styles.pillarEmoji}>{emoji}</Text>
            <Text style={styles.pillarLabel}>{label}</Text>
          </View>
          <View style={styles.pillarRow}>
            <Text style={styles.pillarSide}>{low}</Text>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = value[key] === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => {
                    haptic();
                    onChange({ ...value, [key]: n });
                  }}
                  style={({ pressed }) => [
                    styles.pillarDot,
                    active && { backgroundColor: Colors.gold, borderColor: Colors.gold },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={[styles.pillarDotText, active && { color: Colors.white }]}>{n}</Text>
                </Pressable>
              );
            })}
            <Text style={styles.pillarSide}>{high}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

function ChoiceStep({ title, value, onChange, options }: { title: string; value: string | null; onChange: (v: string) => void; options: { key: string; emoji: string; label: string; description: string }[] }) {
  return (
    <>
      <Text style={styles.stepTitle}>{title}</Text>
      <View style={styles.choiceGrid}>
        {options.map((opt) => {
          const active = value === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                haptic();
                onChange(opt.key);
              }}
              style={({ pressed }) => [
                styles.choiceCard,
                active && { borderColor: Colors.gold, backgroundColor: Colors.goldLight },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.choiceEmoji}>{opt.emoji}</Text>
              <Text style={styles.choiceLabel}>{opt.label}</Text>
              <Text style={styles.choiceDesc}>{opt.description}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  welcomeIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: Colors.goldLight,
    alignItems: "center", justifyContent: "center",
    alignSelf: "center", marginBottom: 20,
  },
  welcomeTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.dark, textAlign: "center", marginBottom: 10 },
  welcomeSub: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center", marginBottom: 28, lineHeight: 22 },
  typeCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 20,
    borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: 14,
  },
  typeCardPrimary: { borderColor: Colors.gold, backgroundColor: Colors.goldLight },
  typeTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.dark, marginBottom: 4 },
  typeDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, lineHeight: 20 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 },
  topBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  topCounter: { flex: 1, textAlign: "center", fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  progressTrack: { height: 4, backgroundColor: Colors.cardBorder, marginHorizontal: 16, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Colors.gold, borderRadius: 2 },
  stepScroll: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  stepTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.dark, textAlign: "center", marginBottom: 16, lineHeight: 30 },
  subTitle: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", marginBottom: 16, fontFamily: "Inter_400Regular" },
  numberedRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  numLabel: { width: 20, fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.textSecondary, textAlign: "center" },
  input: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.cardBorder, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.dark,
  },
  textarea: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.cardBorder, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.dark,
    minHeight: 120,
  },
  hint: { fontSize: 12, color: Colors.textTertiary, textAlign: "center", marginTop: 12, fontFamily: "Inter_400Regular" },
  focusRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  focusRank: { width: 18, fontFamily: "Inter_700Bold", color: Colors.textSecondary, fontSize: 13 },
  focusEmoji: { fontSize: 20 },
  focusLabel: { fontFamily: "Inter_600SemiBold", color: Colors.dark, fontSize: 14 },
  focusDesc: { fontFamily: "Inter_400Regular", color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  arrowBtn: { padding: 4 },
  ratingDisplay: { fontSize: 72, fontFamily: "Inter_700Bold", textAlign: "center", marginTop: 8, marginBottom: 12 },
  dotRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, marginBottom: 8 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  dotLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  dotLabel: { fontSize: 11, color: Colors.textTertiary, fontFamily: "Inter_400Regular" },
  styleDotRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24, marginBottom: 8, paddingHorizontal: 8 },
  styleDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.cardBorder, backgroundColor: Colors.card },
  styleLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingHorizontal: 4 },
  previewBox: {
    marginTop: 24, padding: 16, borderRadius: 12, backgroundColor: Colors.goldLight,
    borderWidth: 1, borderColor: Colors.gold + "40",
  },
  previewText: { fontStyle: "italic", fontSize: 14, color: Colors.dark, fontFamily: "Inter_400Regular", lineHeight: 20, textAlign: "center" },
  pillar: { marginBottom: 16 },
  pillarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 },
  pillarEmoji: { fontSize: 18 },
  pillarLabel: { fontFamily: "Inter_600SemiBold", color: Colors.dark, fontSize: 14 },
  pillarRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  pillarSide: { fontSize: 10, color: Colors.textTertiary, width: 60, textAlign: "center", fontFamily: "Inter_400Regular" },
  pillarDot: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: Colors.cardBorder, backgroundColor: Colors.card,
    alignItems: "center", justifyContent: "center",
  },
  pillarDotText: { fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, fontSize: 13 },
  choiceGrid: { gap: 10 },
  choiceCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    borderWidth: 2, borderColor: Colors.cardBorder, alignItems: "center",
  },
  choiceEmoji: { fontSize: 26, marginBottom: 6 },
  choiceLabel: { fontFamily: "Inter_600SemiBold", color: Colors.dark, fontSize: 14, marginBottom: 4 },
  choiceDesc: { fontFamily: "Inter_400Regular", color: Colors.textSecondary, fontSize: 12, textAlign: "center" },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: Colors.separator, backgroundColor: Colors.background },
  nextBtn: { backgroundColor: Colors.gold, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  nextText: { color: Colors.white, fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
