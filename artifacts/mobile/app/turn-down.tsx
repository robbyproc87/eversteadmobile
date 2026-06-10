import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

import { AuthGuard } from "@/components/AuthGuard";
import { PreviewEmptyState } from "@/components/PreviewEmptyState";
import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import {
  api,
  isPaymentRequiredError,
  isPreviewAuthError,
  type DailyPlanData,
} from "@/lib/api";

function dateParam(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Non-Pro (or failed-request) closing line. Static on purpose - the
// ritual should never dead-end on an upsell.
const FALLBACK_LINE =
  "That's the day, closed. Tomorrow already has one job written down.";

export default function TurnDownScreen() {
  return (
    <AuthGuard>
      <TurnDownContent />
    </AuthGuard>
  );
}

function TurnDownContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showError } = useToast();
  const queryClient = useQueryClient();

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = dateParam(today);
  const tomorrowStr = dateParam(tomorrow);

  const [step, setStep] = useState(0);
  const [wentWells, setWentWells] = useState<string[]>(["", "", ""]);
  const [prefilled, setPrefilled] = useState(false);
  const [tomorrowPriority, setTomorrowPriority] = useState("");
  const [tomorrowPrefilled, setTomorrowPrefilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sageLine, setSageLine] = useState<string | null>(null);
  const [sageLoading, setSageLoading] = useState(false);

  const todayPlanQuery = useQuery<DailyPlanData>({
    queryKey: ["planner", "daily", todayStr],
    queryFn: () => api.getDailyPlan(todayStr),
  });

  const tomorrowPlanQuery = useQuery<DailyPlanData>({
    queryKey: ["planner", "daily", tomorrowStr],
    queryFn: () => api.getDailyPlan(tomorrowStr),
    enabled: step >= 1,
  });

  // Prefill from existing data exactly once per screen open.
  useEffect(() => {
    const plan = todayPlanQuery.data;
    if (!plan || prefilled) return;
    const existing = ["", "", ""].map(
      (_, i) => plan.wentWells?.find((w) => w.ordinal === i)?.text ?? "",
    );
    setWentWells(existing);
    setPrefilled(true);
  }, [todayPlanQuery.data, prefilled]);

  useEffect(() => {
    const plan = tomorrowPlanQuery.data;
    if (!plan || tomorrowPrefilled) return;
    setTomorrowPriority(
      plan.priorities?.find((p) => p.ordinal === 0)?.text ?? "",
    );
    setTomorrowPrefilled(true);
  }, [tomorrowPlanQuery.data, tomorrowPrefilled]);

  const fetchSageLine = useCallback(
    async (wells: string[], priority: string) => {
      setSageLoading(true);
      try {
        const res = await api.suggestTurnDown({
          date: todayStr,
          wentWells: wells.filter((w) => w.trim()),
          ...(priority.trim() ? { tomorrowPriority: priority.trim() } : {}),
        });
        setSageLine(res?.suggestion?.trim() || FALLBACK_LINE);
      } catch (e) {
        setSageLine(
          isPaymentRequiredError(e) ? FALLBACK_LINE : FALLBACK_LINE,
        );
      } finally {
        setSageLoading(false);
      }
    },
    [todayStr],
  );

  const handleWentWellsNext = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const planId = todayPlanQuery.data?.id;
    const hasContent = wentWells.some((w) => w.trim());
    if (planId && hasContent) {
      setSaving(true);
      try {
        await api.saveWentWells(
          planId,
          wentWells.map((text, ordinal) => ({ ordinal, text })),
        );
        queryClient.invalidateQueries({
          queryKey: ["planner", "daily", todayStr],
        });
      } catch {
        showError("Couldn't save - your words are still here. Try again.");
        return;
      } finally {
        setSaving(false);
      }
    }
    setStep(1);
  }, [todayPlanQuery.data?.id, wentWells, queryClient, todayStr, showError]);

  const handlePriorityNext = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const planId = tomorrowPlanQuery.data?.id;
    if (planId && tomorrowPriority.trim()) {
      setSaving(true);
      try {
        await api.savePriorities(planId, [
          { ordinal: 0, text: tomorrowPriority.trim() },
        ]);
        queryClient.invalidateQueries({
          queryKey: ["planner", "daily", tomorrowStr],
        });
      } catch {
        showError("Couldn't save - your words are still here. Try again.");
        return;
      } finally {
        setSaving(false);
      }
    }
    setStep(2);
    fetchSageLine(wentWells, tomorrowPriority);
  }, [
    tomorrowPlanQuery.data?.id,
    tomorrowPriority,
    queryClient,
    tomorrowStr,
    showError,
    fetchSageLine,
    wentWells,
  ]);

  const handleDone = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.back();
  }, [router]);

  if (isPreviewAuthError(todayPlanQuery.error)) {
    return <PreviewEmptyState screenName="Turn-down" />;
  }

  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Turn-down service</Text>
            <Text style={styles.subtitle}>{dateLabel}</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            accessibilityLabel="Close"
          >
            <Feather name="x" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.dot, i <= step && styles.dotActive]}
            />
          ))}
        </View>

        {step === 0 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>What actually went well?</Text>
            <Text style={styles.stepHint}>
              Three things, big or small. Before the day blurs.
            </Text>
            {todayPlanQuery.isLoading ? (
              <ActivityIndicator
                color={Colors.gold}
                style={{ marginVertical: 24 }}
              />
            ) : (
              wentWells.map((value, i) => (
                <View key={i} style={styles.inputRow}>
                  <Text style={styles.inputNum}>{i + 1}.</Text>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={(t) =>
                      setWentWells((prev) => {
                        const next = [...prev];
                        next[i] = t;
                        return next;
                      })
                    }
                    placeholder={
                      i === 0 ? "Even a small thing counts" : `#${i + 1}`
                    }
                    placeholderTextColor={Colors.textTertiary}
                    returnKeyType={i < 2 ? "next" : "done"}
                  />
                </View>
              ))
            )}
            <PrimaryButton
              label="Continue"
              loading={saving}
              onPress={handleWentWellsNext}
              disabled={todayPlanQuery.isLoading}
            />
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>
              Tomorrow's one thing that matters
            </Text>
            <Text style={styles.stepHint}>
              If only one thing gets done tomorrow, make it this.
            </Text>
            {tomorrowPlanQuery.isLoading ? (
              <ActivityIndicator
                color={Colors.gold}
                style={{ marginVertical: 24 }}
              />
            ) : (
              <TextInput
                style={[styles.input, styles.priorityInput]}
                value={tomorrowPriority}
                onChangeText={setTomorrowPriority}
                placeholder="One priority. Be specific."
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
            )}
            <PrimaryButton
              label="Continue"
              loading={saving}
              onPress={handlePriorityNext}
              disabled={tomorrowPlanQuery.isLoading}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepWrap}>
            <Text style={styles.stepTitle}>From Sage</Text>
            {sageLoading ? (
              <View style={styles.sageCard}>
                <ActivityIndicator color={Colors.gold} />
                <Text style={styles.sageLoadingText}>
                  Reading your day back…
                </Text>
              </View>
            ) : (
              <View style={styles.sageCard}>
                <Feather name="feather" size={18} color={Colors.gold} />
                <Text style={styles.sageText}>{sageLine ?? FALLBACK_LINE}</Text>
              </View>
            )}
            <PrimaryButton
              label="Close the day"
              onPress={handleDone}
              disabled={sageLoading}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        pressed && { opacity: 0.9 },
        (loading || disabled) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.dark} />
      ) : (
        <Text style={styles.primaryBtnText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 24,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.separator,
  },
  dotActive: {
    backgroundColor: Colors.gold,
  },
  stepWrap: {
    gap: 12,
    marginTop: 8,
  },
  stepTitle: {
    fontSize: 19,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  stepHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputNum: {
    width: 18,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.gold,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
  },
  priorityInput: {
    minHeight: 76,
    textAlignVertical: "top",
  },
  sageCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 16,
    padding: 18,
    gap: 10,
    alignItems: "flex-start",
  },
  sageLoadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  sageText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
    lineHeight: 24,
  },
  primaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
});
