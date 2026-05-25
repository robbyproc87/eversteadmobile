import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Colors from "@/constants/colors";

export interface PostSessionMetrics {
  attentionQuality: number;
  mindWanderingCount: number;
  emotionalTurbulence: number;
  reactivity: number;
  tensionAfter: number;
  stressAfter: number;
  insightText: string;
  insightScore: number;
}

interface PostSessionReviewProps {
  visible: boolean;
  durationS: number;
  tensionBefore: number | null;
  stressBefore: number | null;
  isSaving?: boolean;
  onSkip: () => void;
  onComplete: (metrics: PostSessionMetrics) => void;
}

function haptic() {
  if (Platform.OS !== "web") Haptics.selectionAsync();
}

const ATTENTION_LABELS = [
  "Scattered",
  "Wandering",
  "Steady",
  "Focused",
  "Crystal clear",
];

const REACTIVITY_LABELS = [
  "Very calm",
  "Calm",
  "Neutral",
  "Reactive",
  "Very reactive",
];

const TURBULENCE_LABELS = [
  "Very still",
  "Mostly still",
  "Mixed",
  "Stirred",
  "Stormy",
];

const INSIGHT_LABELS = [
  "None",
  "A glimpse",
  "Clear insight",
  "Profound",
];

function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.stepper}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            i === step && styles.stepDotActive,
            i < step && styles.stepDotComplete,
          ]}
        />
      ))}
    </View>
  );
}

function Scale({
  values,
  value,
  onChange,
  size = 32,
}: {
  values: number[];
  value: number;
  onChange: (n: number) => void;
  size?: number;
}) {
  return (
    <View style={styles.scaleRow}>
      {values.map((n) => {
        const active = value === n;
        return (
          <Pressable
            key={n}
            onPress={() => {
              haptic();
              onChange(n);
            }}
            style={({ pressed }) => [
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: 1,
                borderColor: Colors.cardBorder,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: Colors.card,
              },
              active && {
                backgroundColor: Colors.gold,
                borderColor: Colors.gold,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={[
                styles.scaleBtnText,
                active && styles.scaleBtnTextActive,
              ]}
            >
              {n}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function PostSessionReview({
  visible,
  durationS,
  tensionBefore,
  stressBefore,
  isSaving,
  onSkip,
  onComplete,
}: PostSessionReviewProps) {
  const [step, setStep] = useState(0);
  const [attention, setAttention] = useState(3);
  const [mindWandering, setMindWandering] = useState(5);
  const [turbulence, setTurbulence] = useState(3);
  const [reactivity, setReactivity] = useState(3);
  const [tensionAfter, setTensionAfter] = useState(5);
  const [stressAfter, setStressAfter] = useState(5);
  const [insightText, setInsightText] = useState("");
  const [insightScore, setInsightScore] = useState(0);

  useEffect(() => {
    if (visible) {
      setStep(0);
      setAttention(3);
      setMindWandering(5);
      setTurbulence(3);
      setReactivity(3);
      setTensionAfter(tensionBefore ?? 5);
      setStressAfter(stressBefore ?? 5);
      setInsightText("");
      setInsightScore(0);
    }
  }, [visible, tensionBefore, stressBefore]);

  const minutes = Math.max(1, Math.round(durationS / 60));

  const tensionDelta = useMemo(
    () => (tensionBefore != null ? tensionAfter - tensionBefore : null),
    [tensionAfter, tensionBefore],
  );
  const stressDelta = useMemo(
    () => (stressAfter != null && stressBefore != null
      ? stressAfter - stressBefore
      : null),
    [stressAfter, stressBefore],
  );

  const next = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const back = () => {
    haptic();
    setStep((s) => Math.max(0, s - 1));
  };

  const submit = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onComplete({
      attentionQuality: attention,
      mindWanderingCount: mindWandering,
      emotionalTurbulence: turbulence,
      reactivity,
      tensionAfter,
      stressAfter,
      insightText: insightText.trim(),
      insightScore,
    });
  };

  const renderDelta = (delta: number | null, betterIsLower = true) => {
    if (delta == null) return <Text style={styles.summaryDelta}>—</Text>;
    if (delta === 0) {
      return <Text style={styles.summaryDelta}>no change</Text>;
    }
    const positive = betterIsLower ? delta < 0 : delta > 0;
    const sign = delta > 0 ? "+" : "";
    return (
      <Text
        style={[
          styles.summaryDelta,
          positive ? { color: Colors.success } : { color: Colors.error },
        ]}
      >
        {sign}
        {delta}
      </Text>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Stepper step={step} total={5} />
          <ScrollView
            contentContainerStyle={{ gap: 14 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 0 ? (
              <>
                <View style={styles.iconWrap}>
                  <Feather name="eye" size={22} color={Colors.gold} />
                </View>
                <Text style={styles.title}>Attention quality</Text>
                <Text style={styles.subtitle}>
                  Across the {minutes} min, how steady was your attention?
                </Text>
                <Scale
                  values={[1, 2, 3, 4, 5]}
                  value={attention}
                  onChange={setAttention}
                  size={44}
                />
                <Text style={styles.hint}>{ATTENTION_LABELS[attention - 1]}</Text>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <View style={styles.iconWrap}>
                  <Feather name="wind" size={22} color={Colors.gold} />
                </View>
                <Text style={styles.title}>Difficulty</Text>

                <Text style={styles.label}>
                  How often did your mind wander? <Text style={styles.dim}>(0–50)</Text>
                </Text>
                <Scale
                  values={[0, 5, 10, 15, 20, 30, 40, 50]}
                  value={mindWandering}
                  onChange={setMindWandering}
                />
                <Text style={styles.hint}>~{mindWandering} times</Text>

                <Text style={styles.label}>Emotional turbulence</Text>
                <Scale
                  values={[1, 2, 3, 4, 5]}
                  value={turbulence}
                  onChange={setTurbulence}
                />
                <Text style={styles.hint}>{TURBULENCE_LABELS[turbulence - 1]}</Text>

                <Text style={styles.label}>Reactivity to thoughts</Text>
                <Scale
                  values={[1, 2, 3, 4, 5]}
                  value={reactivity}
                  onChange={setReactivity}
                />
                <Text style={styles.hint}>{REACTIVITY_LABELS[reactivity - 1]}</Text>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <View style={styles.iconWrap}>
                  <Feather name="heart" size={22} color={Colors.gold} />
                </View>
                <Text style={styles.title}>Embodied state</Text>
                <Text style={styles.subtitle}>How does your body feel now?</Text>

                <Text style={styles.label}>
                  Body tension <Text style={styles.dim}>(1 relaxed · 10 tense)</Text>
                </Text>
                <Scale
                  values={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                  value={tensionAfter}
                  onChange={setTensionAfter}
                  size={28}
                />
                <Text style={styles.hint}>{tensionAfter}/10</Text>

                <Text style={styles.label}>
                  Mental stress <Text style={styles.dim}>(1 calm · 10 overwhelmed)</Text>
                </Text>
                <Scale
                  values={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                  value={stressAfter}
                  onChange={setStressAfter}
                  size={28}
                />
                <Text style={styles.hint}>{stressAfter}/10</Text>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <View style={styles.iconWrap}>
                  <Feather name="zap" size={22} color={Colors.gold} />
                </View>
                <Text style={styles.title}>Insight</Text>
                <Text style={styles.subtitle}>
                  Anything that surfaced — a noticing, a question, a clarity?
                </Text>
                <TextInput
                  value={insightText}
                  onChangeText={setInsightText}
                  placeholder="What did you notice?"
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  style={styles.textInput}
                />

                <Text style={styles.label}>Depth of insight</Text>
                <Scale
                  values={[0, 1, 2, 3]}
                  value={insightScore}
                  onChange={setInsightScore}
                />
                <Text style={styles.hint}>{INSIGHT_LABELS[insightScore]}</Text>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <View style={styles.iconWrap}>
                  <Feather name="check" size={22} color={Colors.success} />
                </View>
                <Text style={styles.title}>Summary</Text>
                <Text style={styles.subtitle}>
                  {minutes} minute session
                </Text>

                <View style={styles.summaryGrid}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Attention</Text>
                    <Text style={styles.summaryValue}>{attention}/5</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Mind wandering</Text>
                    <Text style={styles.summaryValue}>~{mindWandering}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Turbulence</Text>
                    <Text style={styles.summaryValue}>{turbulence}/5</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Reactivity</Text>
                    <Text style={styles.summaryValue}>{reactivity}/5</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tension after</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Text style={styles.summaryValue}>{tensionAfter}/10</Text>
                      {renderDelta(tensionDelta, true)}
                    </View>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Stress after</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Text style={styles.summaryValue}>{stressAfter}/10</Text>
                      {renderDelta(stressDelta, true)}
                    </View>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Insight</Text>
                    <Text style={styles.summaryValue}>
                      {INSIGHT_LABELS[insightScore]}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={onSkip}
                disabled={isSaving}
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && !isSaving && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.btnGhostText}>Skip</Text>
              </Pressable>
              {step > 0 ? (
                <Pressable
                  onPress={back}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.btnSecondary,
                    pressed && !isSaving && { opacity: 0.7 },
                  ]}
                >
                  <Feather name="chevron-left" size={14} color={Colors.dark} />
                  <Text style={styles.btnSecondaryText}>Back</Text>
                </Pressable>
              ) : null}
              {step < 4 ? (
                <Pressable
                  onPress={next}
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.btnPrimaryText}>Next</Text>
                  <Feather name="chevron-right" size={14} color={Colors.dark} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={submit}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    isSaving && { opacity: 0.6 },
                    pressed && !isSaving && { opacity: 0.85 },
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={Colors.dark} />
                  ) : (
                    <>
                      <Feather name="check" size={14} color={Colors.dark} />
                      <Text style={styles.btnPrimaryText}>Save</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "92%",
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  stepper: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginBottom: 4,
  },
  stepDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.cardBorder,
  },
  stepDotActive: {
    backgroundColor: Colors.gold,
  },
  stepDotComplete: {
    backgroundColor: Colors.goldDark,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    marginTop: 6,
  },
  dim: {
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  scaleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  scaleBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  scaleBtnTextActive: {
    color: Colors.dark,
    fontFamily: "Inter_700Bold",
  },
  textInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    textAlignVertical: "top",
    backgroundColor: Colors.background,
  },
  summaryGrid: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  summaryDelta: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  btnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btnGhostText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.gold,
  },
  btnPrimaryText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
});
