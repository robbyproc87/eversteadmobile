import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

import Colors from "@/constants/colors";

const menuItems = [
  {
    icon: "headphones",
    label: "Meditation",
    subtitle: "Guided sessions",
    route: "/meditation",
  },
  {
    icon: "book",
    label: "Books",
    subtitle: "Reading progress",
    route: "/books",
  },
  {
    icon: "play-circle",
    label: "Courses",
    subtitle: "Learning paths",
    route: "/courses",
  },
  {
    icon: "trending-up",
    label: "Trends",
    subtitle: "Your progress over time",
    route: "/trends",
  },
  {
    icon: "settings",
    label: "Settings",
    subtitle: "Account & preferences",
    route: "/settings",
  },
] as const;

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <Text style={styles.title}>More</Text>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.menuList}>
          {menuItems.map((item, index) => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [
                styles.menuItem,
                index < menuItems.length - 1 && styles.menuItemBorder,
                pressed && { backgroundColor: Colors.background },
              ]}
              onPress={() => {
                if (Platform.OS !== "web")
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(item.route as any);
              }}
            >
              <View style={styles.menuItemIcon}>
                <Feather
                  name={item.icon as any}
                  size={20}
                  color={Colors.gold}
                />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemLabel}>{item.label}</Text>
                <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={Colors.textTertiary}
              />
            </Pressable>
          ))}
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
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 12,
  },
  menuList: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  menuItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemContent: {
    flex: 1,
    gap: 2,
  },
  menuItemLabel: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  menuItemSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
});
