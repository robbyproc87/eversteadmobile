import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";

/**
 * The volume control used across meditation surfaces.
 *
 * Extracted from the timer screen so the generated-session player can use
 * the same one. The player previously had no volume control at all, which
 * left no way to balance a guided voice against the ambient bed underneath
 * it — the pairing that makes a generated session listenable.
 *
 * Discrete stops rather than a continuous slider: a five-position control
 * is reliable to hit with a thumb, and nobody needs 63%.
 */
export function VolumeControl({
  label,
  icon = "volume-2",
  value,
  onChange,
}: {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.area}>
      <View style={styles.labelRow}>
        <Feather name={icon} size={14} color={Colors.textSecondary} />
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${value}%` }]} />
        <View style={styles.buttons}>
          {[0, 25, 50, 75, 100].map((v) => (
            <Pressable
              key={v}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                onChange(v);
              }}
              style={styles.stop}
              hitSlop={12}
              accessibilityLabel={`Set ${label} to ${v} percent`}
            >
              <View
                style={[styles.stopDot, value >= v && { backgroundColor: Colors.gold }]}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { marginTop: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  track: {
    height: 24,
    justifyContent: "center",
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: Colors.separator,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.goldLight,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  stop: { padding: 4 },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
  },
});
