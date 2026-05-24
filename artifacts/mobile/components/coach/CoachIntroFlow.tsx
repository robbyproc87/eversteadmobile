import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { COACHES, COACH_IDS, getCoach } from "@/lib/coach";

const FLAG = "everstead_coach_intro_seen";

interface Step {
  kind: "intro" | "coach";
  coachId?: string;
  title: string;
  subtitle?: string;
  body: string;
}

const STEPS: Step[] = [
  {
    kind: "intro",
    title: "Meet Your Coaching Team",
    body:
      "Everstead now has five specialized coaches, each with unique expertise to guide different areas of your life.",
  },
  ...COACH_IDS.map<Step>((id) => {
    const c = COACHES[id];
    return {
      kind: "coach",
      coachId: id,
      title: c.name,
      subtitle: c.title,
      body: c.description,
    };
  }),
];

function OrbBig({ coachId, size = 64 }: { coachId: string; size?: number }) {
  const coach = getCoach(coachId);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: coach.color,
        alignItems: "center",
        justifyContent: "center",
        ...Platform.select({
          ios: {
            shadowColor: coach.color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.45,
            shadowRadius: 12,
          },
          android: { elevation: 5 },
          web: { boxShadow: `0 4px 16px ${coach.color}88` },
        }),
      }}
    >
      <View
        style={{
          width: size * 0.45,
          height: size * 0.45,
          borderRadius: size * 0.225,
          backgroundColor: coach.gradientFrom,
          opacity: 0.9,
          transform: [{ translateX: -size * 0.1 }, { translateY: -size * 0.1 }],
        }}
      />
    </View>
  );
}

function OrbRow({ activeIndex }: { activeIndex: number }) {
  return (
    <View style={styles.orbRow}>
      {COACH_IDS.map((id, idx) => {
        const stepIdx = idx + 1;
        const isActive = stepIdx === activeIndex;
        const coach = getCoach(id);
        return (
          <View
            key={id}
            style={[
              styles.orbDot,
              { backgroundColor: coach.color },
              isActive && styles.orbDotActive,
            ]}
          />
        );
      })}
    </View>
  );
}

export function CoachIntroFlow() {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(FLAG).then((v) => {
      if (cancelled) return;
      if (v !== "true") setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = () => {
    AsyncStorage.setItem(FLAG, "true").catch(() => {});
    setVisible(false);
  };

  if (!visible) return null;
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={finish}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Pressable
            onPress={finish}
            style={styles.skip}
            accessibilityLabel="Skip intro"
          >
            <Feather name="x" size={20} color={Colors.textSecondary} />
          </Pressable>

          <View style={styles.body}>
            {step.kind === "intro" ? (
              <View style={styles.iconCluster}>
                {COACH_IDS.map((id) => (
                  <View key={id} style={{ marginHorizontal: -6 }}>
                    <OrbBig coachId={id} size={44} />
                  </View>
                ))}
              </View>
            ) : (
              <OrbBig coachId={step.coachId!} size={80} />
            )}
            <Text
              style={[
                styles.title,
                step.coachId
                  ? { color: getCoach(step.coachId).color }
                  : null,
              ]}
            >
              {step.title}
            </Text>
            {step.subtitle && (
              <Text style={styles.subtitle}>{step.subtitle}</Text>
            )}
            <Text style={styles.copy}>{step.body}</Text>
          </View>

          <OrbRow activeIndex={index} />

          <View style={styles.actions}>
            {index > 0 && (
              <Pressable
                onPress={() => setIndex((i) => Math.max(0, i - 1))}
                style={({ pressed }) => [
                  styles.secondary,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                if (isLast) finish();
                else setIndex((i) => i + 1);
              }}
              style={({ pressed }) => [
                styles.primary,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.primaryText}>
                {isLast ? "Start" : "Next"}
              </Text>
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
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.card ?? "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  skip: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  body: {
    alignItems: "center",
    gap: 12,
    paddingTop: 20,
  },
  iconCluster: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  copy: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 4,
  },
  orbRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  orbDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.35,
  },
  orbDotActive: {
    opacity: 1,
    transform: [{ scale: 1.4 }],
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  primary: {
    flex: 1,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  secondary: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  secondaryText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
});
