import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDrawer } from "@/contexts/DrawerContext";
import Colors from "@/constants/colors";

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const { openDrawer } = useDrawer();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openDrawer();
          }}
          style={({ pressed }) => [
            styles.menuButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Feather name="menu" size={22} color={Colors.dark} />
        </Pressable>
        <Text style={styles.title}>Planner</Text>
        <View style={styles.menuButton} />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="calendar" size={36} color={Colors.gold} />
          </View>
          <Text style={styles.emptyTitle}>Plan Your Day</Text>
          <Text style={styles.emptySubtext}>
            Organize your tasks, set priorities, and build your daily routine
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 12,
  },
  emptyState: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 48,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
