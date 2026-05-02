import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AuthGuard } from "@/components/AuthGuard";
import { ArchitectureVisual } from "@/components/life-architecture/ArchitectureVisual";
import { BreakInterstitial } from "@/components/life-architecture/BreakInterstitial";
import { SectionCard } from "@/components/life-architecture/SectionCard";
import { VersionHistoryModal } from "@/components/life-architecture/VersionHistoryModal";
import Colors from "@/constants/colors";
import {
  ApiError,
  EMPTY_LIFE_ARCHITECTURE,
  api,
  lifeArchitectureApi,
  type BillingStatus,
  type LifeArchitectureData,
  type LifeArchitectureSnapshot,
} from "@/lib/api";
import {
  SECTIONS,
  type SectionId,
  completionCount,
  shouldShowBreakBefore,
} from "@/lib/life-architecture";

function isPro(billing: BillingStatus | undefined): boolean {
  if (!billing) return false;
  if (billing.active === true) return true;
  const plan = (billing.plan || "").toLowerCase();
  return plan === "pro" || plan === "premium" || plan === "trial";
}

function UpgradePrompt() {
  const router = useRouter();
  return (
    <View style={styles.upgradeWrap}>
      <View style={styles.upgradeCard}>
        <View style={styles.upgradeIcon}>
          <Feather name="lock" size={28} color={Colors.gold} />
        </View>
        <Text style={styles.upgradeTitle}>Life Architecture is a Pro feature</Text>
        <Text style={styles.upgradeBody}>
          Build a foundation, raise pillars, draw blueprints, and write the
          vision of your year. Available on Everstead Pro.
        </Text>
        <Pressable
          onPress={() => router.push("/settings" as never)}
          style={({ pressed }) => [
            styles.upgradeBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather name="zap" size={14} color="#fff" />
          <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function LifeArchitectureScreen() {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingNext, setPendingNext] = useState<SectionId | null>(null);

  const billingQuery = useQuery<BillingStatus>({
    queryKey: ["billing", "status"],
    queryFn: () => api.getBillingStatus(),
  });

  const isProUser = isPro(billingQuery.data);

  const snapshotQuery = useQuery<LifeArchitectureSnapshot | null>({
    queryKey: ["life-architecture"],
    queryFn: () => lifeArchitectureApi.get(),
    enabled: isProUser,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 402) return false;
      return failureCount < 1;
    },
  });

  if (billingQuery.isLoading) {
    return (
      <AuthGuard>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.gold} />
        </View>
      </AuthGuard>
    );
  }

  if (!isProUser) {
    return (
      <AuthGuard>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
        >
          <UpgradePrompt />
        </ScrollView>
      </AuthGuard>
    );
  }

  // Treat 402 the same as upgrade-required.
  if (
    snapshotQuery.error instanceof ApiError &&
    snapshotQuery.error.status === 402
  ) {
    return (
      <AuthGuard>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
        >
          <UpgradePrompt />
        </ScrollView>
      </AuthGuard>
    );
  }

  const snapshot = snapshotQuery.data ?? null;
  const data: LifeArchitectureData = snapshot
    ? {
        foundation: snapshot.foundation ?? EMPTY_LIFE_ARCHITECTURE.foundation,
        pillars: snapshot.pillars ?? [],
        blueprints: snapshot.blueprints ?? [],
        rituals: snapshot.rituals ?? [],
        guardrails: snapshot.guardrails ?? [],
        vision: snapshot.vision ?? EMPTY_LIFE_ARCHITECTURE.vision,
      }
    : EMPTY_LIFE_ARCHITECTURE;

  const versions = snapshot?.versions ?? [];
  const completed = completionCount(data);

  const handleEvolve = (id: SectionId) => {
    if (shouldShowBreakBefore(id)) {
      setPendingNext(id);
      return;
    }
    openSection(id);
  };

  const openSection = (id: SectionId) => {
    router.push({
      pathname: "/life-architecture-section",
      params: { sectionId: id },
    } as never);
  };

  return (
    <AuthGuard>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Life Architecture</Text>
            <Text style={styles.subtitle}>
              Your annual vision & plan, shaped section by section.
            </Text>
          </View>
          <Pressable
            onPress={() => setHistoryOpen(true)}
            style={({ pressed }) => [
              styles.historyBtn,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel="Open version history"
          >
            <Feather name="clock" size={18} color={Colors.gold} />
          </Pressable>
        </View>

        {snapshotQuery.isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.gold} />
          </View>
        ) : snapshotQuery.isError ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={20} color={Colors.error} />
            <Text style={styles.errorText}>
              Couldn't load your architecture. You can still begin a new section
              below.
            </Text>
          </View>
        ) : (
          <ArchitectureVisual data={data} />
        )}

        {completed === 0 && (
          <View style={styles.beginCard}>
            <Feather name="compass" size={20} color={Colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.beginTitle}>
                Start with the Foundation.
              </Text>
              <Text style={styles.beginBody}>
                Sage will guide you through each section, one breath at a
                time.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.sectionList}>
          {SECTIONS.map((s) => (
            <SectionCard
              key={s.id}
              section={s}
              data={data}
              onEvolve={handleEvolve}
            />
          ))}
        </View>

        <View style={styles.footerHint}>
          <Feather name="info" size={12} color={Colors.textTertiary} />
          <Text style={styles.footerHintText}>
            Every save creates a snapshot. Look back any time.
          </Text>
        </View>
      </ScrollView>

      <BreakInterstitial
        visible={!!pendingNext}
        nextSectionId={pendingNext}
        onContinue={() => {
          const id = pendingNext;
          setPendingNext(null);
          if (id) openSection(id);
        }}
        onDismiss={() => setPendingNext(null)}
      />

      <VersionHistoryModal
        visible={historyOpen}
        versions={versions}
        onClose={() => setHistoryOpen(false)}
      />
    </AuthGuard>
  );
}

const shadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  android: { elevation: 1 },
  web: { boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  historyBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: "center",
  },
  errorBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fdeceb",
    borderColor: "#f5c6c2",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.error,
    lineHeight: 17,
  },
  beginCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    backgroundColor: Colors.goldLight,
    borderRadius: 12,
    alignItems: "center",
  },
  beginTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  beginBody: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  sectionList: {
    gap: 10,
  },
  footerHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  footerHintText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  upgradeWrap: {
    paddingVertical: 24,
  },
  upgradeCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
    ...shadow,
  },
  upgradeIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: Colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  upgradeTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    textAlign: "center",
  },
  upgradeBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.gold,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  upgradeBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
