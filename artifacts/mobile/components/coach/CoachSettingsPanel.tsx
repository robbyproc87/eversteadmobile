import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { coachApi, type CoachSettings } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";

const TOGGLES: Array<{ key: keyof CoachSettings; label: string; help: string }> = [
  { key: "accessJournal", label: "Journal entries", help: "Reference your reflections" },
  { key: "accessPlanner", label: "Planner & goals", help: "Reference plans and TEs" },
  { key: "accessMeditation", label: "Meditation", help: "Reference meditation history" },
  { key: "accessBooks", label: "Books & courses", help: "Reference your growth library" },
  { key: "accessMood", label: "Mood data", help: "Reference your mood signals" },
];

function proactivityLabel(v: number): string {
  if (v <= 15) return "Silent — I'll come to you when I need help";
  if (v <= 40) return "Quiet — Only speak when spoken to";
  if (v <= 60) return "Balanced — Offer suggestions occasionally";
  if (v <= 85) return "Active — Help me stay on track";
  return "Always on — Keep me accountable";
}

function Slider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  // Simple stepped slider: 5 dots × 20pts each.
  const steps = [0, 25, 50, 75, 100];
  return (
    <View style={styles.sliderRow}>
      {steps.map((s) => {
        const active = value >= s - 5;
        return (
          <Pressable
            key={s}
            onPress={() => onChange(s)}
            style={[
              styles.sliderDot,
              active && styles.sliderDotActive,
            ]}
            accessibilityLabel={`Set proactivity to ${s}`}
          />
        );
      })}
    </View>
  );
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CoachSettingsPanel({ visible, onClose }: Props) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [local, setLocal] = useState<CoachSettings | null>(null);

  const settingsQuery = useQuery<CoachSettings>({
    queryKey: ["coach", "settings"],
    queryFn: coachApi.getSettings,
    enabled: visible,
    retry: 0,
  });

  useEffect(() => {
    if (settingsQuery.data && !local) setLocal(settingsQuery.data);
  }, [settingsQuery.data, local]);

  useEffect(() => {
    if (!visible) setLocal(null);
  }, [visible]);

  const saveMut = useMutation({
    mutationFn: (input: Partial<CoachSettings>) => coachApi.saveSettings(input),
    onSuccess: (data) => {
      qc.setQueryData(["coach", "settings"], data);
      showToast("Saved", { variant: "success" });
      onClose();
    },
    onError: (err) => {
      showToast(
        err instanceof Error ? err.message : "Could not save settings",
        { variant: "error" },
      );
    },
  });

  const proactivity = useMemo(
    () => local?.proactivityLevel ?? settingsQuery.data?.proactivityLevel ?? 50,
    [local, settingsQuery.data],
  );

  const current = local ?? settingsQuery.data;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Coach Settings</Text>
          <Pressable
            onPress={onClose}
            style={styles.iconBtn}
            accessibilityLabel="Close settings"
          >
            <Feather name="x" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {settingsQuery.isLoading || !current ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.gold} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scroll}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Proactivity</Text>
              <Text style={styles.sectionHelp}>
                How often should your coaches reach out?
              </Text>
              <Slider
                value={proactivity}
                onChange={(v) =>
                  setLocal((p) => ({
                    ...(p ?? current),
                    proactivityLevel: v,
                  }))
                }
              />
              <Text style={styles.proactivityText}>
                {proactivityLabel(proactivity)}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What your coaches can see</Text>
              <Text style={styles.sectionHelp}>
                Toggle off any area you'd rather keep private.
              </Text>
              {TOGGLES.map((t) => {
                const val = (current[t.key] as boolean) ?? true;
                return (
                  <View key={String(t.key)} style={styles.toggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.toggleLabel}>{t.label}</Text>
                      <Text style={styles.toggleHelp}>{t.help}</Text>
                    </View>
                    <Switch
                      value={val}
                      onValueChange={(v) =>
                        setLocal((p) => ({
                          ...(p ?? current),
                          [t.key]: v,
                        }))
                      }
                      trackColor={{ false: "#d4d4d4", true: Colors.gold }}
                      thumbColor={Platform.OS === "android" ? "#fff" : undefined}
                    />
                  </View>
                );
              })}
            </View>

            <Text style={styles.privacyFooter}>
              Everstead never shares your data with third parties. These
              toggles control what your in-app coaches can reference.
            </Text>
          </ScrollView>
        )}

        <View style={styles.footer}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!local) return onClose();
              saveMut.mutate(local);
            }}
            disabled={saveMut.isPending || !local}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.9 },
              (saveMut.isPending || !local) && { opacity: 0.5 },
            ]}
          >
            {saveMut.isPending ? (
              <ActivityIndicator color={Colors.dark} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee2c4",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  iconBtn: { padding: 6 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 20, gap: 24 },
  section: {
    backgroundColor: Colors.card ?? "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  sectionHelp: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  sliderDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#e5e0d4",
  },
  sliderDotActive: { backgroundColor: Colors.gold },
  proactivityText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
    textAlign: "center",
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1ead7",
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  toggleHelp: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  privacyFooter: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee2c4",
    backgroundColor: Colors.card ?? "#fff",
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
});
