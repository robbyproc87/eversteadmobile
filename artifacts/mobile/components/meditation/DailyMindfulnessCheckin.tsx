import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { api, ApiError, isPaymentRequiredError } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { usePlan } from "@/lib/plan";
import { UpgradePrompt } from "@/components/UpgradePrompt";

function haptic() {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function isToday(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

const AWARENESS_LABELS = ["Foggy", "Distracted", "Present", "Clear", "Sharp"];

export default function DailyMindfulnessCheckin() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const plan = usePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const checkinQuery = useQuery({
    queryKey: ["meditation", "daily-checkin"],
    queryFn: api.getDailyMindfulnessCheckin,
    retry: 0,
  });

  const existing = checkinQuery.data && isToday(checkinQuery.data.date) ? checkinQuery.data : null;

  const [editing, setEditing] = useState(false);
  const [awareness, setAwareness] = useState<number>(existing?.awarenessRating ?? 3);
  const [wellbeing, setWellbeing] = useState<number>(existing?.wellbeingRating ?? 5);

  useEffect(() => {
    if (existing) {
      setAwareness(existing.awarenessRating ?? 3);
      setWellbeing(existing.wellbeingRating ?? 5);
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.saveDailyMindfulnessCheckin({
        awarenessRating: awareness,
        wellbeingRating: wellbeing,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meditation", "daily-checkin"] });
      showSuccess("Check-in saved");
      haptic();
      setEditing(false);
    },
    onError: (err) => {
      if (isPaymentRequiredError(err)) {
        setUpgradeOpen(true);
        return;
      }
      const msg = err instanceof ApiError ? err.message : "Couldn't save check-in.";
      showError(msg);
    },
  });

  if (checkinQuery.isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  if (!plan.loading && !plan.isPro) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <Feather name="sun" size={16} color={Colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Daily Mindfulness Check-in</Text>
            <Text style={styles.subtitle}>
              Track awareness and wellbeing — a Pro feature.
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 12 }}>
          <UpgradePrompt
            variant="compact"
            feature="mindfulness_checkin"
            message="Daily mindfulness check-ins are a Pro feature."
          />
        </View>
      </View>
    );
  }

  if (existing && !editing) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <Feather name="check-circle" size={16} color={Colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Today&apos;s Check-in</Text>
            <Text style={styles.subtitle}>
              Awareness {existing.awarenessRating}/5 · Wellbeing {existing.wellbeingRating}/10
            </Text>
          </View>
          <Pressable
            onPress={() => {
              haptic();
              setEditing(true);
            }}
            style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
            hitSlop={6}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Feather name="sun" size={16} color={Colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Daily Mindfulness Check-in</Text>
          <Text style={styles.subtitle}>How present do you feel right now?</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Awareness</Text>
      <View style={styles.btnRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => {
              haptic();
              setAwareness(n);
            }}
            style={({ pressed }) => [
              styles.awarenessBtn,
              awareness === n && styles.awarenessBtnActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={[
                styles.awarenessBtnText,
                awareness === n && styles.awarenessBtnTextActive,
              ]}
            >
              {n}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.fieldHint}>{AWARENESS_LABELS[awareness - 1]}</Text>

      <Text style={styles.fieldLabel}>Overall Wellbeing</Text>
      <View style={styles.btnRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <Pressable
            key={n}
            onPress={() => {
              haptic();
              setWellbeing(n);
            }}
            style={({ pressed }) => [
              styles.wbBtn,
              wellbeing === n && styles.wbBtnActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[styles.wbBtnText, wellbeing === n && styles.wbBtnTextActive]}>
              {n}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actionRow}>
        {existing ? (
          <Pressable
            onPress={() => {
              haptic();
              setEditing(false);
            }}
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            if (!plan.isPro) {
              setUpgradeOpen(true);
              return;
            }
            saveMutation.mutate();
          }}
          disabled={saveMutation.isPending}
          style={({ pressed }) => [
            styles.saveBtn,
            saveMutation.isPending && { opacity: 0.6 },
            pressed && !saveMutation.isPending && { opacity: 0.85 },
          ]}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.dark} />
          ) : (
            <>
              <Feather name="check" size={14} color={Colors.dark} />
              <Text style={styles.saveBtnText}>Save check-in</Text>
            </>
          )}
        </Pressable>
      </View>
      {upgradeOpen && (
        <View style={{ marginTop: 12 }}>
          <UpgradePrompt
            variant="full"
            feature="mindfulness_checkin"
            message="Daily mindfulness check-ins are a Pro feature."
            onSuccess={() => setUpgradeOpen(false)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.goldLight,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.dark },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.background },
  editBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  fieldLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1,
    color: Colors.textSecondary, marginTop: 14, marginBottom: 8,
  },
  fieldHint: { fontSize: 11, color: Colors.textTertiary, marginTop: 4, fontFamily: "Inter_400Regular" },
  btnRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  awarenessBtn: {
    flex: 1, minWidth: 36, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder,
    alignItems: "center",
  },
  awarenessBtnActive: { backgroundColor: Colors.goldLight, borderColor: Colors.gold },
  awarenessBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  awarenessBtnTextActive: { color: Colors.dark, fontFamily: "Inter_700Bold" },
  wbBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.cardBorder,
    alignItems: "center", justifyContent: "center",
  },
  wbBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  wbBtnText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  wbBtnTextActive: { color: Colors.dark, fontFamily: "Inter_700Bold" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 16, justifyContent: "flex-end" },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.background },
  cancelBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  saveBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.gold,
  },
  saveBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.dark },
});
