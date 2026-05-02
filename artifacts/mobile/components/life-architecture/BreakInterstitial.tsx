import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";
import { getSection, type SectionId } from "@/lib/life-architecture";

interface Props {
  visible: boolean;
  nextSectionId: SectionId | null;
  onContinue: () => void;
  onDismiss: () => void;
}

const COPY: Record<SectionId, { title: string; body: string }> = {
  foundation: { title: "", body: "" },
  pillars: { title: "", body: "" },
  blueprints: {
    title: "Take a breath.",
    body:
      "You've named the columns of your life. Before we draw the plans, give yourself a moment. Stretch, look out a window — you're shaping a year.",
  },
  rituals: { title: "", body: "" },
  guardrails: {
    title: "Pause before you fence it in.",
    body:
      "You've designed the build and the rituals. Now we set the rules. Settle in — guardrails are how this stays yours.",
  },
  vision: { title: "", body: "" },
};

export function BreakInterstitial({
  visible,
  nextSectionId,
  onContinue,
  onDismiss,
}: Props) {
  if (!nextSectionId) return null;
  const copy = COPY[nextSectionId];
  if (!copy.title) return null;
  const section = getSection(nextSectionId);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: section.bg }]}>
            <Feather name="wind" size={28} color={section.color} />
          </View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.secondaryText}>Not yet</Text>
            </Pressable>
            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: section.color },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.primaryText}>Continue to {section.label}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20, 20, 20, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 21,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    width: "100%",
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: "center",
  },
  secondaryText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  primaryBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
