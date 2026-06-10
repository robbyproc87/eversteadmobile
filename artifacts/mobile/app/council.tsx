import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { UpgradePrompt } from "@/components/UpgradePrompt";
import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import { councilApi, isPaymentRequiredError, type CouncilChunk } from "@/lib/api";
import { getCoach } from "@/lib/coach";

// Deliberation order mirrors the server: strategy, challenge, body,
// reframe, synthesis.
const COUNCIL_ORDER = ["summit", "forge", "zen", "muse", "sage"] as const;

interface Statement {
  coachId: string;
  text: string;
  isVerdict: boolean;
}

function CouncilOrb({
  coachId,
  size,
  active,
  spoken,
}: {
  coachId: string;
  size: number;
  active: boolean;
  spoken: boolean;
}) {
  const coach = getCoach(coachId);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.18,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: coach.color,
        opacity: active || spoken ? 1 : 0.3,
        transform: [{ scale: pulse }],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: size * 0.21,
          backgroundColor: "#ffffff55",
        }}
      />
    </Animated.View>
  );
}

export default function CouncilScreen() {
  return (
    <AuthGuard>
      <CouncilContent />
    </AuthGuard>
  );
}

function CouncilContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showError } = useToast();

  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<"ask" | "deliberating" | "done" | "locked">(
    "ask",
  );
  const [statements, setStatements] = useState<Statement[]>([]);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(t);
  }, [statements.length, speaking]);

  const convene = useCallback(async () => {
    const trimmed = question.trim();
    if (trimmed.length < 10) {
      showError("Bring the council a real question.");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setPhase("deliberating");
    setStatements([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const chunk of councilApi.convene(
        trimmed,
        controller.signal,
      ) as AsyncGenerator<CouncilChunk>) {
        if (chunk.speaking) {
          setSpeaking(chunk.speaking);
        }
        if (chunk.coach && chunk.text) {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          const statement: Statement = {
            coachId: chunk.coach,
            text: chunk.text,
            isVerdict: chunk.isVerdict === true,
          };
          setStatements((prev) => [...prev, statement]);
        }
        if (chunk.error) {
          showError(chunk.error);
        }
        if (chunk.done) {
          setSpeaking(null);
          setPhase("done");
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      }
      // Stream ended without an explicit done (e.g. server error mid-way):
      // keep whatever counsel arrived rather than wiping it.
      setSpeaking(null);
      setPhase((p) => (p === "deliberating" ? "done" : p));
    } catch (e) {
      setSpeaking(null);
      if (isPaymentRequiredError(e)) {
        setPhase("locked");
        return;
      }
      const aborted =
        e instanceof Error && (e.name === "AbortError" || /abort/i.test(e.message));
      if (!aborted) {
        showError(
          e instanceof Error ? e.message : "The council was interrupted.",
        );
        setPhase("ask");
      }
    }
  }, [question, showError]);

  const reset = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    abortRef.current?.abort();
    setQuestion("");
    setStatements([]);
    setSpeaking(null);
    setPhase("ask");
  }, []);

  const spokenIds = new Set(statements.map((s) => s.coachId));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.inner,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>The Council</Text>
            <Text style={styles.subtitle}>
              One question. Five coaches. All of them have read your file.
            </Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            accessibilityLabel="Close council"
          >
            <Feather name="x" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.orbRow}>
          {COUNCIL_ORDER.map((id) => (
            <View key={id} style={styles.orbWrap}>
              <CouncilOrb
                coachId={id}
                size={40}
                active={speaking === id}
                spoken={spokenIds.has(id)}
              />
              <Text
                style={[
                  styles.orbLabel,
                  (speaking === id || spokenIds.has(id)) && {
                    color: getCoach(id).color,
                  },
                ]}
              >
                {getCoach(id).name}
              </Text>
            </View>
          ))}
        </View>

        {phase === "locked" ? (
          <ScrollView contentContainerStyle={{ paddingTop: 16 }}>
            <UpgradePrompt
              feature="cross_coach_reference"
              message="The Council convenes for Everstead Pro members."
              onSuccess={() => setPhase("ask")}
            />
          </ScrollView>
        ) : phase === "ask" ? (
          <View style={styles.askArea}>
            <TextInput
              style={styles.questionInput}
              value={question}
              onChangeText={setQuestion}
              placeholder={
                "The question you keep circling.\n“Do I take the new role?” “Do I move?”"
              }
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={1000}
            />
            <Pressable
              onPress={convene}
              style={({ pressed }) => [
                styles.conveneBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Feather name="users" size={16} color={Colors.dark} />
              <Text style={styles.conveneBtnText}>Convene the council</Text>
            </Pressable>
            <Text style={styles.askHint}>
              The deliberation takes about a minute. Worth it.
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.transcript}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.questionCard}>
              <Text style={styles.questionLabel}>The question</Text>
              <Text style={styles.questionText}>{question.trim()}</Text>
            </View>

            {statements.map((s, i) => {
              const coach = getCoach(s.coachId);
              return (
                <View
                  key={i}
                  style={[
                    styles.statementCard,
                    { borderLeftColor: coach.color },
                    s.isVerdict && styles.verdictCard,
                  ]}
                >
                  <View style={styles.statementHeader}>
                    <CouncilOrb
                      coachId={s.coachId}
                      size={20}
                      active={false}
                      spoken
                    />
                    <Text style={[styles.statementCoach, { color: coach.color }]}>
                      {coach.name}
                    </Text>
                    {s.isVerdict ? (
                      <Text style={styles.verdictBadge}>SYNTHESIS</Text>
                    ) : null}
                  </View>
                  <Text style={styles.statementText}>{s.text}</Text>
                </View>
              );
            })}

            {phase === "deliberating" && (
              <View style={styles.speakingRow}>
                <ActivityIndicator size="small" color={Colors.gold} />
                <Text style={styles.speakingText}>
                  {speaking
                    ? `${getCoach(speaking).name} is speaking…`
                    : "The council is convening…"}
                </Text>
              </View>
            )}

            {phase === "done" && (
              <Pressable
                onPress={reset}
                style={({ pressed }) => [
                  styles.againBtn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.againBtnText}>Bring another question</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
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
    lineHeight: 18,
  },
  orbRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  orbWrap: {
    alignItems: "center",
    gap: 5,
  },
  orbLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textTertiary,
  },
  askArea: {
    flex: 1,
    gap: 14,
    paddingTop: 8,
  },
  questionInput: {
    minHeight: 120,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    textAlignVertical: "top",
    lineHeight: 23,
  },
  conveneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 15,
  },
  conveneBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  askHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
  },
  transcript: {
    gap: 12,
    paddingBottom: 32,
  },
  questionCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    gap: 4,
  },
  questionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  questionText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    lineHeight: 21,
  },
  statementCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 3,
    padding: 14,
    gap: 8,
  },
  verdictCard: {
    borderColor: Colors.gold,
    borderLeftWidth: 3,
  },
  statementHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statementCoach: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  verdictBadge: {
    marginLeft: "auto",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.goldDark,
    backgroundColor: Colors.goldLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    letterSpacing: 0.6,
  },
  statementText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 21,
  },
  speakingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  speakingText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  againBtn: {
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    marginTop: 4,
  },
  againBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
  },
});
