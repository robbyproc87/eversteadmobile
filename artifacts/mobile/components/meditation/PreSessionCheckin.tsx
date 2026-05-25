import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";

function haptic() {
  if (Platform.OS !== "web") Haptics.selectionAsync();
}

interface PreSessionCheckinProps {
  visible: boolean;
  onCancel: () => void;
  onComplete: (values: { tensionBefore: number; stressBefore: number }) => void;
}

const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function ScaleRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.scaleRow}>
      {SCALE.map((n) => {
        const active = value === n;
        return (
          <Pressable
            key={n}
            onPress={() => {
              haptic();
              onChange(n);
            }}
            style={({ pressed }) => [
              styles.scaleBtn,
              active && styles.scaleBtnActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={[styles.scaleBtnText, active && styles.scaleBtnTextActive]}
            >
              {n}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function PreSessionCheckin({
  visible,
  onCancel,
  onComplete,
}: PreSessionCheckinProps) {
  const [tension, setTension] = useState(5);
  const [stress, setStress] = useState(5);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>
            <View style={styles.iconWrap}>
              <Feather name="activity" size={24} color={Colors.gold} />
            </View>
            <Text style={styles.title}>Before we begin</Text>
            <Text style={styles.subtitle}>
              A quick check-in so we can measure how this session affects you.
            </Text>

            <Text style={styles.label}>
              Body tension <Text style={styles.dim}>(1 relaxed · 10 very tense)</Text>
            </Text>
            <ScaleRow value={tension} onChange={setTension} />
            <Text style={styles.valueLabel}>{tension}/10</Text>

            <Text style={styles.label}>
              Mental stress <Text style={styles.dim}>(1 calm · 10 overwhelmed)</Text>
            </Text>
            <ScaleRow value={stress} onChange={setStress} />
            <Text style={styles.valueLabel}>{stress}/10</Text>

            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  haptic();
                  onCancel();
                }}
                style={({ pressed }) => [
                  styles.btnSecondary,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                  onComplete({ tensionBefore: tension, stressBefore: stress });
                }}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Feather name="play" size={16} color={Colors.dark} />
                <Text style={styles.btnPrimaryText}>Start session</Text>
              </Pressable>
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
    maxWidth: 420,
    maxHeight: "90%",
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 22,
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
    marginTop: -4,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    marginTop: 4,
  },
  dim: {
    color: Colors.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  valueLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: -4,
  },
  scaleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  scaleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
  },
  scaleBtnActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  scaleBtnText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  scaleBtnTextActive: {
    color: Colors.dark,
    fontFamily: "Inter_700Bold",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    justifyContent: "flex-end",
  },
  btnSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
