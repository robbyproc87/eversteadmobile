import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import {
  api,
  ApiError,
  isPaymentRequiredError,
  type GeneratedMeditationDetail,
} from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { usePlan } from "@/lib/plan";
import { UpgradePrompt } from "@/components/UpgradePrompt";

interface Props {
  visible: boolean;
  onClose: () => void;
  onGenerated?: (m: GeneratedMeditationDetail) => void;
}

const DURATIONS: Array<{ value: number; label: string }> = [
  { value: 300, label: "5 min" },
  { value: 600, label: "10 min" },
  { value: 1200, label: "20 min" },
];

const TYPE_PRESETS = [
  "Calm",
  "Focus",
  "Sleep",
  "Gratitude",
  "Stress Relief",
  "Energy",
];

function haptic() {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function PulsingOrb() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.2, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return (
    <View style={styles.orbContainer}>
      <Animated.View style={[styles.orb, { transform: [{ scale }] }]} />
      <View style={styles.orbInner} />
    </View>
  );
}

export default function GenerateSessionDialog({ visible, onClose, onGenerated }: Props) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const [meditationType, setMeditationType] = useState("Calm");
  const [customType, setCustomType] = useState("");
  const [duration, setDuration] = useState(600);

  useEffect(() => {
    if (visible) {
      setMeditationType("Calm");
      setCustomType("");
      setDuration(600);
    }
  }, [visible]);

  const plan = usePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () =>
      api.generateMeditation({
        meditationType: customType.trim() || meditationType,
        durationS: duration,
      }),
    onSuccess: (m) => {
      queryClient.invalidateQueries({ queryKey: ["meditation", "generated"] });
      showSuccess("Meditation generated");
      haptic();
      onGenerated?.(m);
      onClose();
    },
    onError: (err) => {
      if (isPaymentRequiredError(err)) {
        setUpgradeOpen(true);
        return;
      }
      const msg = err instanceof ApiError ? err.message : "Couldn't generate. Please try again.";
      showError(msg);
    },
  });

  const generating = generateMutation.isPending;
  const blocked = !plan.isPro;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={generating ? () => {} : onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {generating ? (
            <View style={styles.generatingBox}>
              <PulsingOrb />
              <Text style={styles.generatingTitle}>Generating your session…</Text>
              <Text style={styles.generatingSubtitle}>
                Crafting a {Math.round(duration / 60)}-minute {customType.trim() || meditationType.toLowerCase()} meditation
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={styles.header}>
                <Text style={styles.title}>Generate a session</Text>
                <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                  <Feather name="x" size={20} color={Colors.textSecondary} />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.typeGrid}>
                {TYPE_PRESETS.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => {
                      haptic();
                      setMeditationType(t);
                      setCustomType("");
                    }}
                    style={({ pressed }) => [
                      styles.typeChip,
                      meditationType === t && !customType.trim() && styles.typeChipActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        meditationType === t && !customType.trim() && styles.typeChipTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={customType}
                onChangeText={setCustomType}
                placeholder="Or describe a custom focus…"
                placeholderTextColor={Colors.textTertiary}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Duration</Text>
              <View style={styles.durationRow}>
                {DURATIONS.map((d) => (
                  <Pressable
                    key={d.value}
                    onPress={() => {
                      haptic();
                      setDuration(d.value);
                    }}
                    style={({ pressed }) => [
                      styles.durationBtn,
                      duration === d.value && styles.durationBtnActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationBtnText,
                        duration === d.value && styles.durationBtnTextActive,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => {
                  if (blocked) {
                    setUpgradeOpen(true);
                    return;
                  }
                  generateMutation.mutate();
                }}
                style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.85 }]}
              >
                <Feather name="zap" size={16} color={Colors.dark} />
                <Text style={styles.generateBtnText}>
                  {blocked ? "Upgrade to generate" : "Generate"}
                </Text>
              </Pressable>
              {upgradeOpen && (
                <View style={{ marginTop: 16 }}>
                  <UpgradePrompt
                    variant="full"
                    feature="ai_meditations"
                    message="Generated meditations are a Pro feature. Upgrade to create custom sessions."
                    onSuccess={() => setUpgradeOpen(false)}
                  />
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center", width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.cardBorder, marginVertical: 8,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.dark },
  fieldLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1,
    color: Colors.textSecondary, marginTop: 12, marginBottom: 8,
  },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card,
  },
  typeChipActive: { borderColor: Colors.gold, backgroundColor: Colors.goldLight },
  typeChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  typeChipTextActive: { color: Colors.dark, fontFamily: "Inter_600SemiBold" },
  input: {
    marginTop: 10, padding: 12, borderRadius: 12,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder,
    fontSize: 14, color: Colors.dark, fontFamily: "Inter_400Regular",
  },
  durationRow: { flexDirection: "row", gap: 8 },
  durationBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
    borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card,
  },
  durationBtnActive: { borderColor: Colors.gold, backgroundColor: Colors.goldLight },
  durationBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  durationBtnTextActive: { color: Colors.dark, fontFamily: "Inter_700Bold" },
  generateBtn: {
    marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.gold,
  },
  generateBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.dark },
  generatingBox: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 20 },
  orbContainer: { width: 100, height: 100, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  orb: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.goldLight,
  },
  orbInner: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.gold,
  },
  generatingTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.dark, textAlign: "center" },
  generatingSubtitle: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: Colors.textSecondary, marginTop: 8, textAlign: "center",
  },
});
