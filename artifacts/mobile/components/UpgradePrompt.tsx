import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { api, type BillingStatus } from "@/lib/api";

// Play Store policy: no in-app purchase flow and no tappable checkout
// link for digital goods. Plain-text pointer only; the refresh button
// below picks up an upgrade made on the web.
const MANAGE_COPY =
  "Manage your Everstead Pro subscription at my.everstead.app";

interface Props {
  variant?: "compact" | "full";
  feature?: string;
  message?: string;
  onSuccess?: () => void;
}

export function UpgradePrompt({
  variant = "full",
  feature,
  message,
  onSuccess,
}: Props) {
  const [checking, setChecking] = useState(false);
  const queryClient = useQueryClient();

  async function handleRefreshStatus() {
    setChecking(true);
    try {
      let nextBilling: BillingStatus | undefined;
      try {
        nextBilling = await queryClient.fetchQuery<BillingStatus>({
          queryKey: ["billing", "status"],
          queryFn: api.getBillingStatus,
          staleTime: 0,
        });
      } catch {
        nextBilling = undefined;
      }
      const plan = (nextBilling?.plan ?? "free").toLowerCase();
      const trialEndsAt = nextBilling?.trialEndsAt ?? null;
      const trialActive =
        !!trialEndsAt && new Date(trialEndsAt).getTime() > Date.now();
      const isPro =
        plan === "pro" ||
        plan === "premium" ||
        nextBilling?.active === true ||
        plan === "trial" ||
        trialActive;
      if (isPro) {
        onSuccess?.();
      }
    } finally {
      setChecking(false);
    }
  }

  if (variant === "compact") {
    return (
      <View style={styles.compact}>
        <Feather name="lock" size={14} color={Colors.dark} />
        <Text style={styles.compactText}>
          {message ?? "Everstead Pro feature"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.full}>
      <View style={styles.iconWrap}>
        <Feather name="lock" size={22} color={Colors.gold} />
      </View>
      <Text style={styles.title}>Everstead Pro</Text>
      <Text style={styles.body}>
        {message ??
          (feature
            ? `Unlock ${feature.replaceAll("_", " ")} and the rest of Everstead's Pro toolkit.`
            : "Unlock AI coaching, unlimited journaling, generated meditations, and more.")}
      </Text>

      <Text style={styles.manageCopy}>{MANAGE_COPY}</Text>

      <Pressable
        onPress={handleRefreshStatus}
        disabled={checking}
        style={({ pressed }) => [
          styles.cta,
          pressed && { opacity: 0.9 },
          checking && { opacity: 0.6 },
        ]}
        accessibilityLabel="Refresh subscription status"
      >
        {checking ? (
          <ActivityIndicator color={Colors.dark} />
        ) : (
          <>
            <Feather name="refresh-cw" size={16} color={Colors.dark} />
            <Text style={styles.ctaText}>Already upgraded? Refresh</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.goldLight ?? "#faf0d4",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  compactText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  full: {
    backgroundColor: Colors.card ?? "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#eee2c4",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.goldLight ?? "#faf0d4",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  manageCopy: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
    lineHeight: 19,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
});
