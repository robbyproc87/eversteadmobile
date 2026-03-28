import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useDrawer } from "@/contexts/DrawerContext";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";
import type { ActivityItem } from "@/lib/api";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <View style={styles.statCard}>
      <Feather name={icon as any} size={18} color={Colors.gold} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.quickAction,
        pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
      ]}
      onPress={() => {
        if (Platform.OS !== "web")
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <View style={styles.quickActionIcon}>
        <Feather name={icon as any} size={20} color={Colors.gold} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const iconMap: Record<string, string> = {
    journal: "edit-3",
    plan: "check-square",
    meditation: "headphones",
    reading: "book",
    course: "play-circle",
  };
  const iconName = iconMap[item.type] || "activity";

  return (
    <View style={styles.activityRow}>
      <View style={styles.activityIcon}>
        <Feather name={iconName as any} size={16} color={Colors.textSecondary} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={styles.activityDescription} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
      </View>
      <Text style={styles.activityTime}>
        {new Date(item.timestamp).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
}

export default function TodayScreen() {
  const { user } = useAuth();
  const { openDrawer } = useDrawer();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: api.getDashboardStats,
    retry: 1,
  });

  const activityQuery = useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: api.getDashboardActivity,
    retry: 1,
  });

  const todayQuery = useQuery({
    queryKey: ["plan", "today"],
    queryFn: api.getTodayPlan,
    retry: 1,
  });

  useQuery({
    queryKey: ["billing", "status"],
    queryFn: api.getBillingStatus,
    retry: 1,
  });

  const isRefreshing =
    statsQuery.isRefetching ||
    activityQuery.isRefetching ||
    todayQuery.isRefetching;

  const handleRefresh = () => {
    statsQuery.refetch();
    activityQuery.refetch();
    todayQuery.refetch();
  };

  const stats = statsQuery.data;
  const activities = activityQuery.data;
  const todayPlan = todayQuery.data;
  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "";

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.gold}
          />
        }
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              openDrawer();
            }}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Feather name="menu" size={22} color={Colors.dark} />
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>
              {getGreeting()}
              {firstName ? `, ${firstName}` : ""}
            </Text>
            <Text style={styles.date}>{getFormattedDate()}</Text>
          </View>
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="settings" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsStrip}
        >
          <StatCard
            label="Weekly Score"
            value={stats?.weeklyScore ?? "\u2014"}
            icon="trending-up"
          />
          <StatCard
            label="Journal Streak"
            value={
              stats?.journalStreak != null
                ? `${stats.journalStreak}d`
                : "\u2014"
            }
            icon="edit-3"
          />
          <StatCard
            label="Planner Streak"
            value={
              stats?.plannerStreak != null
                ? `${stats.plannerStreak}d`
                : "\u2014"
            }
            icon="check-square"
          />
          <StatCard
            label="Pages Read"
            value={stats?.pagesRead ?? "\u2014"}
            icon="book"
          />
          <StatCard
            label="Days Planned"
            value={stats?.daysPlanned ?? "\u2014"}
            icon="calendar"
          />
        </ScrollView>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Focus</Text>
          <View style={styles.focusCard}>
            <View style={styles.focusAccent} />
            <View style={styles.focusContent}>
              {todayPlan?.focus ? (
                <>
                  <Text style={styles.focusText}>{todayPlan.focus}</Text>
                  {todayPlan.focusDescription ? (
                    <Text style={styles.focusDescription}>
                      {todayPlan.focusDescription}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.focusDescription}>
                  {todayQuery.isLoading
                    ? "Loading your focus\u2026"
                    : "Plan your day to set a focus"}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <QuickAction
              icon="edit-3"
              label="Journal"
              onPress={() => router.push("/(tabs)/journal")}
            />
            <QuickAction
              icon="calendar"
              label="Plan Today"
              onPress={() => router.push("/(tabs)/planner")}
            />
            <QuickAction
              icon="headphones"
              label="Meditate"
              onPress={() => router.push("/(tabs)/meditation")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {activityQuery.isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.gold} />
            </View>
          ) : activities && activities.length > 0 ? (
            <View style={styles.activityList}>
              {activities.slice(0, 10).map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="activity" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No recent activity</Text>
              <Text style={styles.emptySubtext}>
                Start your journey today
              </Text>
            </View>
          )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  greeting: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  statsStrip: {
    paddingBottom: 4,
    gap: 12,
  },
  statCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    minWidth: 120,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    marginBottom: 14,
  },
  focusCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  focusAccent: {
    width: 4,
    backgroundColor: Colors.gold,
  },
  focusContent: {
    flex: 1,
    padding: 16,
    gap: 6,
  },
  focusText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  focusDescription: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  activityList: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  activityContent: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  activityDescription: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  activityTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyState: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 40,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
});
