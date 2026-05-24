import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
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
import { api, isPreviewAuthError } from "@/lib/api";
import type { ActivityItem } from "@/lib/api";
import { MenuIcon } from "@/components/MenuIcon";
import { PreviewEmptyState } from "@/components/PreviewEmptyState";
import { getTodayQuote } from "@/lib/daily-quotes";
import { getTodaySong } from "@/lib/daily-songs";
import { useDailyContent } from "@/hooks/useDailyContent";

const ONBOARDING_RESUME_DISMISS_KEY = "everstead-onboarding-resume-dismissed";

function getTimeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function haptic(s: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(s);
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return Colors.textSecondary;
  if (score <= 3) return "#d4534a";
  if (score <= 6) return "#e6a23c";
  if (score <= 9) return "#5b8def";
  return Colors.gold;
}

function DailyBriefing({ name, dailyGreeting, dailyQuote }: { name: string; dailyGreeting?: string; dailyQuote?: { text: string; author: string } | null }) {
  const fallback = useMemo(() => getTodayQuote(), []);
  const quote = dailyQuote || fallback;
  const greeting = getTimeOfDayGreeting();
  const isPersonalized = !!dailyQuote || !!dailyGreeting;

  let personalSuffix = name;
  if (dailyGreeting) {
    const stripped = dailyGreeting.replace(/^(Good morning|Good afternoon|Good evening|Morning|Afternoon|Evening),?\s*/i, "");
    personalSuffix = stripped !== dailyGreeting ? stripped : dailyGreeting.replace(/[,.]?\s*$/, "");
  }

  return (
    <View style={styles.briefing}>
      <View style={styles.briefingOrbOuter} />
      <View style={styles.briefingOrbInner} />
      <Text style={styles.briefingDate}>{getFormattedDate().toUpperCase()}</Text>
      <Text style={styles.briefingGreeting}>{greeting},</Text>
      <Text style={styles.briefingName}>{personalSuffix}.</Text>
      <View style={styles.briefingDivider} />
      <Text style={styles.briefingQuote}>&ldquo;{quote.text}&rdquo;</Text>
      <View style={styles.briefingAuthorRow}>
        <Text style={styles.briefingAuthor}>— {quote.author}</Text>
        {isPersonalized ? <Feather name="zap" size={11} color={Colors.gold} style={{ marginLeft: 6 }} /> : null}
      </View>
    </View>
  );
}

function DailySongCard({ aiSong }: { aiSong?: { title: string; artist: string; reason: string } | null }) {
  const fallback = useMemo(() => getTodaySong(), []);
  const song = aiSong
    ? { title: aiSong.title, artist: aiSong.artist, why: aiSong.reason }
    : fallback;

  const open = async (url: string) => {
    haptic();
    try {
      if (Platform.OS === "web") {
        Linking.openURL(url);
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch {
      // ignore
    }
  };

  const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.artist}`)}`;
  const appleUrl = `https://music.apple.com/us/search?term=${encodeURIComponent(`${song.title} ${song.artist}`)}`;

  return (
    <View style={styles.songCard}>
      <View style={styles.songIconBox}>
        <Feather name="music" size={18} color={Colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {song.title}
          {aiSong ? "  ✦" : ""}
        </Text>
        <Text style={styles.songArtist} numberOfLines={1}>{song.artist}</Text>
        <Text style={styles.songWhy} numberOfLines={1}>{song.why}</Text>
      </View>
      <Pressable onPress={() => open(spotifyUrl)} style={({ pressed }) => [styles.songLinkBtn, pressed && { opacity: 0.6 }]} hitSlop={8}>
        <Feather name="external-link" size={16} color={Colors.textSecondary} />
      </Pressable>
      <Pressable onPress={() => open(appleUrl)} style={({ pressed }) => [styles.songLinkBtn, pressed && { opacity: 0.6 }]} hitSlop={8}>
        <Feather name="headphones" size={16} color={Colors.textSecondary} />
      </Pressable>
    </View>
  );
}

interface DashboardStatsExt {
  weeklyScore?: number | null;
  journalStreak?: number;
  plannerStreak?: number;
  pagesRead?: number;
  daysPlanned?: number;
  meditationMinutes7d?: number;
}

function WeeklyMomentumStrip({ stats }: { stats: DashboardStatsExt | undefined }) {
  const router = useRouter();
  const items = [
    {
      label: "Weekly Score",
      value: stats?.weeklyScore != null ? `${stats.weeklyScore}/10` : "—",
      icon: "star" as const,
      color: scoreColor(stats?.weeklyScore ?? null),
      onPress: () => router.push("/(tabs)/planner"),
    },
    {
      label: "Journal",
      value: `${stats?.journalStreak ?? 0}d`,
      icon: "edit-3" as const,
      color: "#f59e0b",
      onPress: () => router.push("/(tabs)/journal"),
    },
    {
      label: "Planner",
      value: `${stats?.plannerStreak ?? 0}d`,
      icon: "calendar" as const,
      color: "#10b981",
      onPress: () => router.push("/(tabs)/planner"),
    },
    {
      label: "Pages",
      value: `${stats?.pagesRead ?? 0}`,
      icon: "book-open" as const,
      color: Colors.gold,
      onPress: () => router.push("/growth-library"),
    },
    {
      label: "Planned",
      value: `${stats?.daysPlanned ?? 0}/7`,
      icon: "check-square" as const,
      color: "#14b8a6",
      onPress: () => router.push("/(tabs)/planner"),
    },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.momentumStrip}
      style={{ marginHorizontal: -20 }}
    >
      {items.map((it) => (
        <Pressable
          key={it.label}
          onPress={() => {
            haptic();
            it.onPress();
          }}
          style={({ pressed }) => [styles.momentumCard, pressed && { opacity: 0.85 }]}
        >
          <View style={[styles.momentumIconWrap, { backgroundColor: it.color + "20" }]}>
            <Feather name={it.icon} size={13} color={it.color} />
          </View>
          <Text style={styles.momentumLabel}>{it.label.toUpperCase()}</Text>
          <Text style={styles.momentumValue}>{it.value}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function YourFocusSection({ todayPlan }: { todayPlan?: { focus?: string; focusDescription?: string } }) {
  const router = useRouter();
  return (
    <View>
      <Text style={styles.h2}>Your Focus</Text>
      <View style={styles.focusStack}>
        <Pressable
          onPress={() => router.push("/(tabs)/planner")}
          style={({ pressed }) => [styles.focusCard, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.focusAccent} />
          <View style={{ flex: 1, padding: 14 }}>
            <Text style={styles.focusKicker}>TODAY</Text>
            <Text style={styles.focusText}>
              {todayPlan?.focus || "Plan your day to set a focus"}
            </Text>
            {todayPlan?.focusDescription ? (
              <Text style={styles.focusDesc}>{todayPlan.focusDescription}</Text>
            ) : null}
          </View>
          <Feather name="chevron-right" size={18} color={Colors.textSecondary} style={{ marginRight: 12 }} />
        </Pressable>

        <Pressable
          onPress={() => router.push("/(tabs)/planner")}
          style={({ pressed }) => [styles.focusCard, pressed && { opacity: 0.9 }]}
        >
          <View style={[styles.focusAccent, { backgroundColor: "#5b8def" }]} />
          <View style={{ flex: 1, padding: 14 }}>
            <Text style={styles.focusKicker}>THIS WEEK</Text>
            <Text style={styles.focusText}>Set your Truly Exceptionals</Text>
          </View>
          <Feather name="chevron-right" size={18} color={Colors.textSecondary} style={{ marginRight: 12 }} />
        </Pressable>

        <Pressable
          onPress={() => router.push("/life-architecture")}
          style={({ pressed }) => [styles.focusCard, pressed && { opacity: 0.9 }]}
        >
          <View style={[styles.focusAccent, { backgroundColor: "#a78bfa" }]} />
          <View style={{ flex: 1, padding: 14 }}>
            <Text style={styles.focusKicker}>THIS YEAR</Text>
            <Text style={styles.focusText}>Design your Life Architecture</Text>
          </View>
          <Feather name="chevron-right" size={18} color={Colors.textSecondary} style={{ marginRight: 12 }} />
        </Pressable>
      </View>
    </View>
  );
}

function OnboardingResumeCard() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem(ONBOARDING_RESUME_DISMISS_KEY);
      setDismissed(v === "1");
    })();
  }, []);

  const onboardingQuery = useQuery({
    queryKey: ["onboarding"],
    queryFn: api.getOnboardingState,
    retry: 0,
  });

  const inProgress =
    !!onboardingQuery.data &&
    onboardingQuery.data.onboardingComplete === false &&
    !!onboardingQuery.data.onboardingType &&
    typeof onboardingQuery.data.onboardingResumeAt === "number";

  if (dismissed || !inProgress) return null;

  return (
    <View style={styles.resumeCard}>
      <View style={styles.resumeIcon}>
        <Feather name="zap" size={16} color={Colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.resumeTitle}>Finish your profile</Text>
        <Text style={styles.resumeDesc}>You&apos;re partway through onboarding. Pick up where you left off.</Text>
      </View>
      <Pressable
        onPress={() => {
          haptic();
          router.push("/onboarding");
        }}
        style={({ pressed }) => [styles.resumeBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.resumeBtnText}>Resume</Text>
      </Pressable>
      <Pressable
        onPress={async () => {
          haptic();
          await AsyncStorage.setItem(ONBOARDING_RESUME_DISMISS_KEY, "1");
          setDismissed(true);
        }}
        hitSlop={8}
        style={({ pressed }) => [styles.resumeClose, pressed && { opacity: 0.6 }]}
      >
        <Feather name="x" size={14} color={Colors.textSecondary} />
      </Pressable>
    </View>
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
        <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.activityDescription} numberOfLines={1}>{item.description}</Text>
        ) : null}
      </View>
      <Text style={styles.activityTime}>
        {new Date(item.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
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
  const dailyContent = useDailyContent();

  const isRefreshing =
    statsQuery.isRefetching || activityQuery.isRefetching || todayQuery.isRefetching;

  const handleRefresh = () => {
    statsQuery.refetch();
    activityQuery.refetch();
    todayQuery.refetch();
    dailyContent.refetch();
  };

  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const isPreview =
    isPreviewAuthError(statsQuery.error) ||
    isPreviewAuthError(activityQuery.error) ||
    isPreviewAuthError(todayQuery.error);

  if (isPreview) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <PreviewEmptyState screenName="Today" />
      </View>
    );
  }

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
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            onPress={() => {
              haptic();
              openDrawer();
            }}
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.6 }]}
          >
            <MenuIcon size={22} color={Colors.dark} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}
          >
            <Feather name="settings" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <OnboardingResumeCard />

        <DailyBriefing
          name={firstName}
          dailyGreeting={dailyContent.data?.greeting}
          dailyQuote={dailyContent.data?.quote ?? undefined}
        />

        <DailySongCard aiSong={dailyContent.data?.song ?? undefined} />

        <WeeklyMomentumStrip stats={statsQuery.data as DashboardStatsExt | undefined} />

        <View style={{ marginTop: 24 }}>
          <YourFocusSection todayPlan={todayQuery.data} />
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Recent Activity</Text>
          {activityQuery.isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.gold} />
            </View>
          ) : activityQuery.data && activityQuery.data.length > 0 ? (
            <View style={styles.activityList}>
              {activityQuery.data.slice(0, 10).map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="activity" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No recent activity</Text>
              <Text style={styles.emptySubtext}>Start your journey today</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  header: { flexDirection: "row", paddingTop: 12, paddingBottom: 16, gap: 12 },
  headerButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.card,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  briefing: {
    position: "relative", overflow: "hidden",
    borderRadius: 20, borderWidth: 1, borderColor: Colors.gold + "30",
    backgroundColor: Colors.card, padding: 22, marginTop: 4,
  },
  briefingOrbOuter: {
    position: "absolute", right: -30, top: -30,
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 1, borderColor: Colors.gold + "20",
  },
  briefingOrbInner: {
    position: "absolute", right: -8, top: -8,
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 1, borderColor: Colors.gold + "15",
  },
  briefingDate: {
    fontSize: 10, fontFamily: "Inter_700Bold",
    color: Colors.textSecondary, letterSpacing: 2, marginBottom: 14,
  },
  briefingGreeting: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.dark, lineHeight: 36 },
  briefingName: { fontSize: 32, fontFamily: "Inter_700Bold", color: Colors.gold, lineHeight: 36 },
  briefingDivider: { height: 1, backgroundColor: Colors.gold + "20", marginVertical: 16 },
  briefingQuote: { fontSize: 16, fontStyle: "italic", color: Colors.textSecondary, lineHeight: 24 },
  briefingAuthorRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  briefingAuthor: { fontSize: 12, color: Colors.textTertiary, fontFamily: "Inter_400Regular" },
  songCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.card, borderRadius: 14, padding: 12, marginTop: 14,
    borderWidth: 1, borderColor: Colors.cardBorder, borderLeftWidth: 3, borderLeftColor: Colors.gold,
  },
  songIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.goldLight, alignItems: "center", justifyContent: "center",
  },
  songTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.dark },
  songArtist: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 1 },
  songWhy: { fontSize: 11, fontStyle: "italic", color: Colors.textTertiary, marginTop: 2 },
  songLinkBtn: { padding: 6 },
  momentumStrip: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6, gap: 10 },
  momentumCard: {
    width: 110, padding: 12, borderRadius: 14,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder,
    gap: 8,
  },
  momentumIconWrap: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  momentumLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: Colors.textSecondary, letterSpacing: 1 },
  momentumValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: Colors.dark },
  section: { marginTop: 28 },
  h2: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.dark, marginBottom: 12 },
  focusStack: { gap: 10 },
  focusCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card, borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  focusAccent: { width: 4, alignSelf: "stretch", backgroundColor: Colors.gold },
  focusKicker: { fontSize: 10, fontFamily: "Inter_700Bold", color: Colors.textTertiary, letterSpacing: 1.2, marginBottom: 4 },
  focusText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.dark },
  focusDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, fontFamily: "Inter_400Regular" },
  resumeCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.goldLight, borderRadius: 14, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.gold + "40",
  },
  resumeIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Colors.card },
  resumeTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.dark },
  resumeDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  resumeBtn: { backgroundColor: Colors.gold, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  resumeBtnText: { color: Colors.white, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  resumeClose: { padding: 6 },
  activityList: {
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.cardBorder, overflow: "hidden",
  },
  activityRow: {
    flexDirection: "row", alignItems: "center", padding: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
  },
  activityIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.background, justifyContent: "center", alignItems: "center",
  },
  activityContent: { flex: 1, gap: 2 },
  activityTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.dark },
  activityDescription: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  activityTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textTertiary },
  loadingContainer: { padding: 40, alignItems: "center" },
  emptyState: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 40,
    alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  emptySubtext: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textTertiary },
});
