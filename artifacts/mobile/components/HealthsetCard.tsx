import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { api } from "@/lib/api";
import {
  isHealthConnectAvailable,
  hasHealthPermissions,
  readTodayHealth,
  requestHealthPermissions,
} from "@/lib/health";

function todayParam(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

type HealthState =
  | { status: "unsupported" }
  | { status: "needs-permission" }
  | { status: "connected"; steps: number | null; sleepH: number | null };

/**
 * The Healthset card. On Android with Health Connect it shows today's
 * sleep and steps and syncs them to /metrics/daily (which also feeds
 * the coach context server-side). Elsewhere it stays an honest
 * coming-soon card.
 */
export function HealthsetCard() {
  const queryClient = useQueryClient();
  const [requesting, setRequesting] = useState(false);
  const lastSyncedRef = useRef<string | null>(null);

  // Best-effort upload; the card renders from local data either way.
  const syncToServer = useCallback(
    (steps: number | null, sleepH: number | null) => {
      if (steps == null && sleepH == null) return;
      const payload = JSON.stringify({ steps, sleepH });
      if (lastSyncedRef.current === payload) return;
      lastSyncedRef.current = payload;
      api
        .upsertDailyMetric({
          date: todayParam(),
          ...(steps != null ? { steps } : {}),
          ...(sleepH != null ? { sleepH } : {}),
        })
        .catch(() => {
          lastSyncedRef.current = null;
        });
    },
    [],
  );

  const healthQuery = useQuery<HealthState>({
    queryKey: ["healthset", todayParam()],
    queryFn: async (): Promise<HealthState> => {
      if (!(await isHealthConnectAvailable())) return { status: "unsupported" };
      if (!(await hasHealthPermissions())) return { status: "needs-permission" };
      const snapshot = await readTodayHealth();
      syncToServer(snapshot.steps, snapshot.sleepH);
      return { status: "connected", ...snapshot };
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const handleConnect = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRequesting(true);
    try {
      await requestHealthPermissions();
      await queryClient.invalidateQueries({ queryKey: ["healthset"] });
    } finally {
      setRequesting(false);
    }
  }, [queryClient]);

  const state = healthQuery.data;

  if (healthQuery.isLoading) {
    return (
      <View style={[styles.card, styles.healthsetCard]}>
        <Header />
        <ActivityIndicator
          size="small"
          color={Colors.gold}
          style={{ marginVertical: 8 }}
        />
      </View>
    );
  }

  if (!state || state.status === "unsupported") {
    return (
      <View style={[styles.card, styles.healthsetCard]}>
        <Header badge="COMING SOON" />
        <Text style={styles.body}>
          Track sleep, energy, and movement to see how your body shapes your
          day.
          {Platform.OS === "android"
            ? " Install Health Connect to turn this on."
            : ""}
        </Text>
      </View>
    );
  }

  if (state.status === "needs-permission") {
    return (
      <View style={[styles.card, styles.healthsetCard]}>
        <Header />
        <Text style={styles.body}>
          Bring last night's sleep and today's movement into your day plan.
        </Text>
        <Pressable
          onPress={handleConnect}
          disabled={requesting}
          style={({ pressed }) => [
            styles.connectBtn,
            pressed && { opacity: 0.85 },
            requesting && { opacity: 0.6 },
          ]}
          accessibilityLabel="Connect Health Connect"
        >
          {requesting ? (
            <ActivityIndicator size="small" color={Colors.dark} />
          ) : (
            <>
              <Feather name="link" size={14} color={Colors.dark} />
              <Text style={styles.connectBtnText}>Connect Health Connect</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.healthsetCard]}>
      <Header
        right={
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              healthQuery.refetch();
            }}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            accessibilityLabel="Refresh health data"
          >
            <Feather
              name="refresh-cw"
              size={14}
              color={Colors.textSecondary}
            />
          </Pressable>
        }
      />
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Feather name="moon" size={16} color="#8B5CF6" />
          <Text style={styles.metricValue}>
            {state.sleepH != null ? `${state.sleepH}h` : "—"}
          </Text>
          <Text style={styles.metricLabel}>sleep</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Feather name="trending-up" size={16} color={Colors.success} />
          <Text style={styles.metricValue}>
            {state.steps != null ? state.steps.toLocaleString() : "—"}
          </Text>
          <Text style={styles.metricLabel}>steps</Text>
        </View>
      </View>
    </View>
  );
}

function Header({
  badge,
  right,
}: {
  badge?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.iconWrap}>
        <Feather name="activity" size={14} color={Colors.goldDark} />
      </View>
      <Text style={styles.title}>Healthset</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    marginBottom: 12,
  },
  healthsetCard: {
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  badge: {
    backgroundColor: Colors.goldLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: Colors.goldDark,
    letterSpacing: 0.5,
  },
  body: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 2,
  },
  connectBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  metric: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  metricValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.separator,
    marginHorizontal: 12,
  },
});
