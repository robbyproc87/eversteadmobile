import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";
import type { CoachActionInfo } from "@/lib/api";

function mapRoute(route: string): string {
  if (!route) return route;
  if (route === "/") return "/(tabs)";
  if (route === "/planner") return "/(tabs)/planner";
  if (route === "/journal") return "/(tabs)/journal";
  if (route === "/meditation") return "/(tabs)/meditation";
  return route;
}

export function CoachActionBadge({ action }: { action: CoachActionInfo }) {
  const router = useRouter();
  const isOk = action.success !== false;
  const color = isOk ? "#059669" : "#dc2626";
  const bg = isOk ? "rgba(5,150,105,0.10)" : "rgba(220,38,38,0.10)";

  const content = (
    <>
      <Feather
        name={isOk ? "check-circle" : "x-circle"}
        size={14}
        color={color}
      />
      <Text style={[styles.text, { color }]} numberOfLines={2}>
        {action.message}
      </Text>
      {action.navigateTo ? (
        <Feather name="external-link" size={13} color={color} />
      ) : null}
    </>
  );

  if (action.navigateTo) {
    const target = action.navigateTo;
    return (
      <Pressable
        onPress={() => {
          try {
            router.push(mapRoute(target) as never);
          } catch {
            // ignore unknown routes
          }
        }}
        style={({ pressed }) => [
          styles.badge,
          { backgroundColor: bg },
          pressed && { opacity: 0.7 },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
    marginTop: 8,
    maxWidth: "100%",
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flexShrink: 1,
  },
});

void Colors;
