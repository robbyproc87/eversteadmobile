import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useDrawer } from "@/contexts/DrawerContext";
import { useToast } from "@/contexts/ToastContext";
import { MenuIcon } from "@/components/MenuIcon";
import { PreviewEmptyState } from "@/components/PreviewEmptyState";
import {
  api,
  ApiError,
  getMoodOption,
  isPreviewAuthError,
  type JournalEntry,
} from "@/lib/api";
import { usePlan, FREE_JOURNAL_LIMIT_PER_MONTH } from "@/lib/plan";
import { UpgradePrompt } from "@/components/UpgradePrompt";

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return `Today · ${time}`;
  if (isYesterday) return `Yesterday · ${time}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function getPreview(entry: JournalEntry): string {
  const text = entry.contentPlainText || entry.content || "";
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

function EntryCard({
  entry,
  onPress,
}: {
  entry: JournalEntry;
  onPress: () => void;
}) {
  const mood = getMoodOption(entry.mood);
  const preview = getPreview(entry);
  const title = entry.title?.trim() || "Untitled entry";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      testID={`journal-entry-${entry.id}`}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.cardDate}>{formatDate(entry.createdAt)}</Text>
        </View>
        {mood ? (
          <View
            style={[
              styles.moodBadge,
              { backgroundColor: `${mood.color}1f`, borderColor: mood.color },
            ]}
          >
            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
          </View>
        ) : null}
      </View>
      {preview ? (
        <Text style={styles.cardPreview} numberOfLines={3}>
          {preview}
        </Text>
      ) : (
        <Text style={[styles.cardPreview, styles.cardPreviewEmpty]}>
          No content yet
        </Text>
      )}
      {entry.tags && entry.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {entry.tags.slice(0, 4).map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{tag}</Text>
            </View>
          ))}
          {entry.tags.length > 4 ? (
            <Text style={styles.tagOverflow}>
              +{entry.tags.length - 4}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openDrawer } = useDrawer();
  const { showError } = useToast();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const entriesQuery = useQuery({
    queryKey: ["journal", "list", debouncedSearch],
    queryFn: () => api.listJournalEntries(debouncedSearch || undefined),
    retry: 1,
  });

  const isPreview = isPreviewAuthError(entriesQuery.error);

  useEffect(() => {
    if (entriesQuery.error && !isPreviewAuthError(entriesQuery.error)) {
      const msg =
        entriesQuery.error instanceof ApiError
          ? entriesQuery.error.message
          : "Couldn't load your journal. Pull to refresh.";
      showError(msg);
    }
  }, [entriesQuery.error, showError]);

  const entries = useMemo(() => {
    const list = entriesQuery.data ?? [];
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [entriesQuery.data]);

  const plan = usePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const entriesThisMonth = useMemo(() => {
    const now = new Date();
    return entries.filter((e) => {
      const d = new Date(e.createdAt);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      );
    }).length;
  }, [entries]);

  const onCreate = useCallback(() => {
    haptic();
    if (
      !plan.isPro &&
      entriesThisMonth >= FREE_JOURNAL_LIMIT_PER_MONTH
    ) {
      setUpgradeOpen(true);
      return;
    }
    router.push("/journal-entry?id=new");
  }, [router, plan.isPro, entriesThisMonth]);

  const onOpen = useCallback(
    (id: string) => {
      router.push(`/journal-entry?id=${encodeURIComponent(id)}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: JournalEntry }) => (
      <EntryCard entry={item} onPress={() => onOpen(item.id)} />
    ),
    [onOpen],
  );

  if (isPreview) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <PreviewEmptyState screenName="Journal" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          onPress={() => {
            haptic();
            openDrawer();
          }}
          style={({ pressed }) => [
            styles.headerBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <MenuIcon size={22} color={Colors.dark} />
        </Pressable>
        <Text style={styles.title}>Journal</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchInner}>
          <Feather name="search" size={16} color={Colors.textSecondary} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search entries"
            placeholderTextColor={Colors.textTertiary}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searchInput.length > 0 ? (
            <Pressable
              onPress={() => setSearchInput("")}
              hitSlop={8}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Feather name="x" size={16} color={Colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {entriesQuery.isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="book-open" size={36} color={Colors.gold} />
          </View>
          <Text style={styles.emptyTitle}>
            {debouncedSearch ? "No matches" : "Your Journal"}
          </Text>
          <Text style={styles.emptySubtext}>
            {debouncedSearch
              ? `Nothing found for "${debouncedSearch}". Try a different search.`
              : "Reflect on your day, track your thoughts, and build self-awareness. Tap the + button to write your first entry."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={entriesQuery.isFetching && !entriesQuery.isLoading}
          onRefresh={() => entriesQuery.refetch()}
        />
      )}

      <Pressable
        onPress={onCreate}
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + 96 },
          pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
        ]}
        accessibilityLabel="Create new journal entry"
        testID="journal-fab"
      >
        <Feather name="plus" size={26} color={Colors.dark} />
      </Pressable>
      {upgradeOpen && (
        <View style={styles.upgradeOverlay}>
          <View style={styles.upgradeSheet}>
            <UpgradePrompt
              variant="full"
              feature="unlimited_journal"
              message={`You've reached ${FREE_JOURNAL_LIMIT_PER_MONTH} journal entries this month. Upgrade to Pro for unlimited journaling.`}
              onSuccess={() => setUpgradeOpen(false)}
            />
            <Pressable
              onPress={() => setUpgradeOpen(false)}
              style={({ pressed }) => [
                styles.upgradeClose,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.upgradeCloseText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  upgradeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 100,
  },
  upgradeSheet: {
    width: "100%",
    maxWidth: 480,
    gap: 12,
  },
  upgradeClose: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  upgradeCloseText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
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
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  searchWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    padding: 0,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 180,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  cardDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  moodBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  moodEmoji: {
    fontSize: 18,
  },
  cardPreview: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 20,
  },
  cardPreviewEmpty: {
    color: Colors.textTertiary,
    fontStyle: "italic",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.goldLight,
  },
  tagChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.goldDark,
  },
  tagOverflow: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  emptyState: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 40,
    marginHorizontal: 20,
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
  fab: {
    position: "absolute",
    right: 22,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.gold,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
});
