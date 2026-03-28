import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AuthGuard } from "@/components/AuthGuard";
import Colors from "@/constants/colors";

type Tab = "books" | "courses";

export default function GrowthLibraryScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("books");

  return (
    <AuthGuard>
      <View style={styles.container}>
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, activeTab === "books" && styles.tabActive]}
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab("books");
            }}
          >
            <Feather
              name="book"
              size={16}
              color={activeTab === "books" ? Colors.gold : Colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "books" && styles.tabTextActive,
              ]}
            >
              Books
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "courses" && styles.tabActive]}
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab("courses");
            }}
          >
            <Feather
              name="play-circle"
              size={16}
              color={
                activeTab === "courses" ? Colors.gold : Colors.textSecondary
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "courses" && styles.tabTextActive,
              ]}
            >
              Courses
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "books" ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="book" size={36} color={Colors.gold} />
              </View>
              <Text style={styles.emptyTitle}>Books</Text>
              <Text style={styles.emptySubtext}>
                Track your reading progress, set goals, and build a reading
                habit
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="play-circle" size={36} color={Colors.gold} />
              </View>
              <Text style={styles.emptyTitle}>Courses</Text>
              <Text style={styles.emptySubtext}>
                Explore learning paths and courses to develop new skills
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.goldLight,
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.dark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
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
