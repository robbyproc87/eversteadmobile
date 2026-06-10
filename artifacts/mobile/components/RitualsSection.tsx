import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import {
  DEFAULT_RITUAL_PREFS,
  ensureNotificationPermission,
  getRitualPrefs,
  setRitualPrefs,
  type RitualPrefs,
} from "@/lib/notifications";

function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function shiftTime(
  hour: number,
  minute: number,
  deltaMinutes: number,
): { hour: number; minute: number } {
  const total = (hour * 60 + minute + deltaMinutes + 24 * 60) % (24 * 60);
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

/**
 * Settings rows for the two daily ritual notifications: the Morning
 * Briefing and the evening Turn-Down.
 */
export function RitualsSection() {
  const { showError } = useToast();
  const [prefs, setPrefs] = useState<RitualPrefs>(DEFAULT_RITUAL_PREFS);

  useEffect(() => {
    getRitualPrefs().then(setPrefs);
  }, []);

  const update = useCallback(
    async (patch: Partial<RitualPrefs>) => {
      const next = await setRitualPrefs(patch);
      setPrefs(next);
    },
    [],
  );

  const handleToggle = useCallback(
    async (key: "morningEnabled" | "eveningEnabled", value: boolean) => {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      if (value) {
        const granted = await ensureNotificationPermission();
        if (!granted) {
          showError("Allow notifications in system settings to enable this.");
          return;
        }
      }
      await update({ [key]: value });
    },
    [update, showError],
  );

  return (
    <View style={styles.card}>
      <RitualRow
        icon="sunrise"
        title="Morning briefing"
        subtitle="A line from Sage to open the day"
        enabled={prefs.morningEnabled}
        hour={prefs.morningHour}
        minute={prefs.morningMinute}
        onToggle={(v) => handleToggle("morningEnabled", v)}
        onShift={(delta) => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          const t = shiftTime(prefs.morningHour, prefs.morningMinute, delta);
          update({ morningHour: t.hour, morningMinute: t.minute });
        }}
      />
      <View style={styles.divider} />
      <RitualRow
        icon="moon"
        title="Turn-down service"
        subtitle="Close the day in two minutes"
        enabled={prefs.eveningEnabled}
        hour={prefs.eveningHour}
        minute={prefs.eveningMinute}
        onToggle={(v) => handleToggle("eveningEnabled", v)}
        onShift={(delta) => {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          const t = shiftTime(prefs.eveningHour, prefs.eveningMinute, delta);
          update({ eveningHour: t.hour, eveningMinute: t.minute });
        }}
      />
    </View>
  );
}

function RitualRow({
  icon,
  title,
  subtitle,
  enabled,
  hour,
  minute,
  onToggle,
  onShift,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  enabled: boolean;
  hour: number;
  minute: number;
  onToggle: (value: boolean) => void;
  onShift: (deltaMinutes: number) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.iconWrap}>
          <Feather name={icon} size={16} color={Colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ true: Colors.gold }}
          thumbColor="#ffffff"
        />
      </View>
      {enabled ? (
        <View style={styles.timeRow}>
          <Pressable
            onPress={() => onShift(-30)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.timeBtn,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityLabel="Earlier by 30 minutes"
          >
            <Feather name="minus" size={14} color={Colors.textSecondary} />
          </Pressable>
          <Text style={styles.timeText}>{formatTime(hour, minute)}</Text>
          <Pressable
            onPress={() => onShift(30)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.timeBtn,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityLabel="Later by 30 minutes"
          >
            <Feather name="plus" size={14} color={Colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 14,
  },
  row: {
    paddingVertical: 12,
    gap: 10,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.separator,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingBottom: 2,
  },
  timeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    minWidth: 80,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
});
