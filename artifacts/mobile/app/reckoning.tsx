import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthGuard } from "@/components/AuthGuard";
import { PreviewEmptyState } from "@/components/PreviewEmptyState";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import Colors from "@/constants/colors";
import { useToast } from "@/contexts/ToastContext";
import {
  ApiError,
  isPaymentRequiredError,
  isPreviewAuthError,
  reckoningApi,
  type ReckoningPillar,
  type ReckoningResult,
} from "@/lib/api";

const VERDICT_STYLES: Record<
  ReckoningPillar["verdict"],
  { label: string; color: string; bg: string }
> = {
  aligned: { label: "LIVED", color: "#3f8f5f", bg: "#3f8f5f22" },
  drifting: { label: "DRIFTING", color: "#c2851a", bg: "#c2851a22" },
  contradicted: { label: "CONTRADICTED", color: "#c24a3f", bg: "#c24a3f22" },
};

export default function ReckoningScreen() {
  return (
    <AuthGuard>
      <ReckoningContent />
    </AuthGuard>
  );
}

function ReckoningContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showError } = useToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [blocker, setBlocker] = useState<
    null | "locked" | "needs_architecture" | "needs_more_data"
  >(null);

  const latestQuery = useQuery<ReckoningResult | null>({
    queryKey: ["reckoning", "latest"],
    queryFn: () => reckoningApi.getLatest(),
    retry: false,
  });

  const runReckoning = useCallback(
    async (force: boolean) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setGenerating(true);
      setBlocker(null);
      try {
        const result = await reckoningApi.generate(force);
        queryClient.setQueryData(["reckoning", "latest"], result);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (e) {
        if (isPaymentRequiredError(e)) {
          setBlocker("locked");
        } else if (e instanceof ApiError && e.status === 409) {
          const code =
            e.body && typeof e.body === "object"
              ? (e.body as Record<string, unknown>).error
              : null;
          setBlocker(
            code === "needs_architecture"
              ? "needs_architecture"
              : "needs_more_data",
          );
        } else {
          showError(
            e instanceof Error ? e.message : "The Reckoning didn't come together.",
          );
        }
      } finally {
        setGenerating(false);
      }
    },
    [queryClient, showError],
  );

  if (isPreviewAuthError(latestQuery.error)) {
    return <PreviewEmptyState screenName="The Reckoning" />;
  }

  const result = latestQuery.data ?? null;
  const reckoning = result?.reckoning ?? null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>The Reckoning</Text>
          <Text style={styles.subtitle}>
            What you said you are, against what you did.
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          accessibilityLabel="Close"
        >
          <Feather name="x" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {blocker === "locked" && (
        <UpgradePrompt
          feature="ai_coaching"
          message="The Reckoning is part of Everstead Pro."
          onSuccess={() => setBlocker(null)}
        />
      )}

      {blocker === "needs_architecture" && (
        <View style={styles.blockerCard}>
          <Feather name="layers" size={22} color={Colors.gold} />
          <Text style={styles.blockerText}>
            The Reckoning audits your behavior against your Life Architecture.
            There's nothing to audit until you've written one.
          </Text>
          <Pressable
            onPress={() => router.push("/life-architecture" as never)}
            style={({ pressed }) => [
              styles.blockerBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.blockerBtnText}>Build your architecture</Text>
          </Pressable>
        </View>
      )}

      {blocker === "needs_more_data" && (
        <View style={styles.blockerCard}>
          <Feather name="clock" size={22} color={Colors.gold} />
          <Text style={styles.blockerText}>
            Not enough lived data yet. Keep planning and journaling - the
            Reckoning will be ready when there's something honest to say.
          </Text>
        </View>
      )}

      {latestQuery.isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.gold} />
        </View>
      ) : !reckoning && !blocker ? (
        <View style={styles.introCard}>
          <Feather name="file-text" size={26} color={Colors.gold} />
          <Text style={styles.introTitle}>
            A monthly audit no other app can run.
          </Text>
          <Text style={styles.introBody}>
            Your Life Architecture says who you mean to be. Your planner,
            journal, and sessions say what you actually did. The Reckoning
            holds the two against each other - pillar by pillar - and ends
            each one with a choice: revise the plan, or recommit to it.
          </Text>
          <Pressable
            onPress={() => runReckoning(false)}
            disabled={generating}
            style={({ pressed }) => [
              styles.runBtn,
              pressed && { opacity: 0.9 },
              generating && { opacity: 0.6 },
            ]}
          >
            {generating ? (
              <ActivityIndicator color={Colors.dark} />
            ) : (
              <>
                <Feather name="file-text" size={16} color={Colors.dark} />
                <Text style={styles.runBtnText}>Run the Reckoning</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : reckoning ? (
        <>
          <View style={styles.coverCard}>
            <Text style={styles.coverPeriod}>{reckoning.period}</Text>
            <Text style={styles.coverHeadline}>{reckoning.headline}</Text>
            {result?.createdAt ? (
              <Text style={styles.coverDate}>
                Issued{" "}
                {new Date(result.createdAt).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            ) : null}
          </View>

          {reckoning.pillars.map((p, i) => {
            const v = VERDICT_STYLES[p.verdict] ?? VERDICT_STYLES.drifting;
            return (
              <View key={i} style={styles.pillarCard}>
                <View style={styles.pillarHeader}>
                  <Text style={styles.pillarName}>{p.name}</Text>
                  <View style={[styles.verdictChip, { backgroundColor: v.bg }]}>
                    <Text style={[styles.verdictChipText, { color: v.color }]}>
                      {v.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.pillarLabel}>You said</Text>
                <Text style={styles.pillarBody}>{p.claim}</Text>

                <Text style={styles.pillarLabel}>The data</Text>
                <Text style={styles.pillarBody}>{p.evidence}</Text>

                <View style={styles.gapBox}>
                  <Text style={styles.gapText}>{p.gap}</Text>
                </View>

                <View style={styles.forkBox}>
                  <Text style={styles.forkQuestion}>{p.fork}</Text>
                  <View style={styles.forkActions}>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                        router.push("/life-architecture" as never);
                      }}
                      style={({ pressed }) => [
                        styles.forkBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Feather name="edit-3" size={13} color={Colors.textSecondary} />
                      <Text style={styles.forkBtnText}>Revise the plan</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (Platform.OS !== "web") Haptics.selectionAsync();
                        router.push({
                          pathname: "/(tabs)/planner",
                          params: { view: "week" },
                        } as never);
                      }}
                      style={({ pressed }) => [
                        styles.forkBtn,
                        styles.forkBtnPrimary,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Feather name="target" size={13} color={Colors.dark} />
                      <Text style={[styles.forkBtnText, { color: Colors.dark }]}>
                        Recommit
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={styles.closingCard}>
            <Feather name="feather" size={16} color={Colors.gold} />
            <Text style={styles.closingText}>{reckoning.closing}</Text>
          </View>

          <Pressable
            onPress={() => runReckoning(true)}
            disabled={generating}
            style={({ pressed }) => [
              styles.rerunBtn,
              pressed && { opacity: 0.7 },
              generating && { opacity: 0.5 },
            ]}
          >
            {generating ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            ) : (
              <Text style={styles.rerunText}>Run a fresh audit</Text>
            )}
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  centerBox: {
    paddingVertical: 60,
    alignItems: "center",
  },
  introCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 20,
    gap: 12,
  },
  introTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  introBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  runBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  runBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  blockerCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 18,
    gap: 12,
    alignItems: "flex-start",
  },
  blockerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  blockerBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  blockerBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  coverCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.gold,
    padding: 20,
    gap: 8,
  },
  coverPeriod: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  coverHeadline: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    lineHeight: 28,
  },
  coverDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  pillarCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 18,
    gap: 8,
  },
  pillarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 2,
  },
  pillarName: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  verdictChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verdictChipText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  pillarLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginTop: 4,
  },
  pillarBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 20,
  },
  gapBox: {
    backgroundColor: Colors.goldLight,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  gapText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
    lineHeight: 21,
  },
  forkBox: {
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    paddingTop: 12,
    marginTop: 6,
    gap: 10,
  },
  forkQuestion: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    lineHeight: 20,
  },
  forkActions: {
    flexDirection: "row",
    gap: 8,
  },
  forkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
  },
  forkBtnPrimary: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  forkBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  closingCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.gold,
    padding: 18,
    gap: 10,
  },
  closingText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
    lineHeight: 23,
  },
  rerunBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  rerunText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textDecorationLine: "underline",
  },
});
