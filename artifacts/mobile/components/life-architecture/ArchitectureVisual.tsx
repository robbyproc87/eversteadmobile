import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";
import type { LifeArchitectureData } from "@/lib/api";
import { SECTIONS, isSectionComplete } from "@/lib/life-architecture";

interface Props {
  data: LifeArchitectureData;
}

export function ArchitectureVisual({ data }: Props) {
  const completed = SECTIONS.filter((s) => isSectionComplete(data, s.id));
  const total = SECTIONS.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.skyline}>
        {/* Vision arch (the dome / skyline) */}
        <View
          style={[
            styles.vision,
            isSectionComplete(data, "vision") && styles.layerActive,
            isSectionComplete(data, "vision") && {
              backgroundColor: SECTIONS[5].bg,
            },
          ]}
        >
          <Feather
            name="sun"
            size={20}
            color={
              isSectionComplete(data, "vision")
                ? SECTIONS[5].color
                : Colors.textTertiary
            }
          />
        </View>

        {/* Guardrails fence */}
        <View style={styles.guardrailRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.guardrailPost,
                isSectionComplete(data, "guardrails") && {
                  backgroundColor: SECTIONS[4].color,
                  opacity: 0.7,
                },
              ]}
            />
          ))}
        </View>

        {/* Rituals gears strip */}
        <View
          style={[
            styles.ritualBand,
            isSectionComplete(data, "rituals") && {
              backgroundColor: SECTIONS[3].bg,
              borderColor: SECTIONS[3].color,
            },
          ]}
        >
          {[0, 1, 2].map((i) => (
            <Feather
              key={i}
              name="settings"
              size={14}
              color={
                isSectionComplete(data, "rituals")
                  ? SECTIONS[3].color
                  : Colors.textTertiary
              }
            />
          ))}
        </View>

        {/* Pillars row with blueprints overlay */}
        <View style={styles.pillarRow}>
          {[0, 1, 2, 3, 4].map((i) => {
            const pillar = data.pillars[i];
            const hasPillar = !!pillar;
            const pillarOn = isSectionComplete(data, "pillars") && hasPillar;
            const pillarHasBlueprint =
              hasPillar &&
              data.blueprints.some((b) => b.pillarId === pillar.id);
            return (
              <View
                key={i}
                style={[
                  styles.pillar,
                  pillarOn && {
                    backgroundColor: SECTIONS[1].bg,
                    borderColor: SECTIONS[1].color,
                  },
                ]}
              >
                {pillarOn && pillarHasBlueprint && (
                  <View
                    style={[
                      styles.blueprintMark,
                      { backgroundColor: SECTIONS[2].color },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Foundation slab */}
        <View
          style={[
            styles.foundation,
            isSectionComplete(data, "foundation") && {
              backgroundColor: SECTIONS[0].bg,
              borderColor: SECTIONS[0].color,
            },
          ]}
        >
          <Text
            style={[
              styles.foundationText,
              isSectionComplete(data, "foundation") && {
                color: SECTIONS[0].color,
              },
            ]}
          >
            FOUNDATION
          </Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {completed.length} of {total} sections shaped
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(completed.length / total) * 100}%` },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  android: { elevation: 1 },
  web: { boxShadow: "0 2px 6px rgba(0,0,0,0.05)" },
});

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    ...shadow,
  },
  skyline: {
    alignItems: "center",
    gap: 6,
    paddingTop: 6,
  },
  layerActive: {},
  vision: {
    width: 110,
    height: 36,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  guardrailRow: {
    flexDirection: "row",
    width: 220,
    height: 14,
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  guardrailPost: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: Colors.cardBorder,
  },
  ritualBand: {
    width: 220,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 18,
  },
  pillarRow: {
    flexDirection: "row",
    width: 220,
    height: 70,
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  pillar: {
    width: 28,
    height: 70,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  blueprintMark: {
    width: 14,
    height: 4,
    borderRadius: 1,
    marginBottom: 6,
  },
  foundation: {
    width: 240,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  foundationText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textTertiary,
    letterSpacing: 1.5,
  },
  progressRow: {
    gap: 6,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.background,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
});
