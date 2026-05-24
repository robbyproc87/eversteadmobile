import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { CHECKOUT_URL } from "@/lib/plan";

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
  const [promo, setPromo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const url = promo.trim()
        ? `${CHECKOUT_URL}?promo=${encodeURIComponent(promo.trim())}`
        : CHECKOUT_URL;
      const result = await WebBrowser.openBrowserAsync(url);
      if (result.type === "dismiss" || result.type === "cancel") {
        onSuccess?.();
      }
    } catch {
      // ignore — user can retry
    } finally {
      setLoading(false);
    }
  }

  if (variant === "compact") {
    return (
      <Pressable
        onPress={handleUpgrade}
        style={({ pressed }) => [
          styles.compact,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Feather name="lock" size={14} color={Colors.dark} />
        <Text style={styles.compactText}>
          {message ?? "Upgrade to unlock"}
        </Text>
        <Feather name="external-link" size={14} color={Colors.dark} />
      </Pressable>
    );
  }

  return (
    <View style={styles.full}>
      <View style={styles.iconWrap}>
        <Feather name="lock" size={22} color={Colors.gold} />
      </View>
      <Text style={styles.title}>Upgrade to Everstead Pro</Text>
      <Text style={styles.body}>
        {message ??
          (feature
            ? `Unlock ${feature.replaceAll("_", " ")} and the rest of Everstead's Pro toolkit.`
            : "Unlock AI coaching, unlimited journaling, generated meditations, and more.")}
      </Text>

      <TextInput
        style={styles.promoInput}
        value={promo}
        onChangeText={setPromo}
        placeholder="Promo code (optional)"
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <Pressable
        onPress={handleUpgrade}
        disabled={loading}
        style={({ pressed }) => [
          styles.cta,
          pressed && { opacity: 0.9 },
          loading && { opacity: 0.6 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.dark} />
        ) : (
          <>
            <Text style={styles.ctaText}>Upgrade</Text>
            <Feather name="arrow-right" size={16} color={Colors.dark} />
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
  promoInput: {
    borderWidth: 1,
    borderColor: "#e5e0d4",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    backgroundColor: Colors.background,
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
