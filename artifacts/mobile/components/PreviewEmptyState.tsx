import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

type Props = {
  screenName: string;
};

export function PreviewEmptyState({ screenName }: Props) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } catch {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Feather name="eye" size={28} color={Colors.gold} />
        </View>
        <Text style={styles.headline}>Preview mode</Text>
        <Text style={styles.body}>
          You're exploring {screenName} without an account. Sign in to see your
          real data.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
          onPress={handleSignIn}
          disabled={busy}
          style={({ pressed }) => [
            styles.button,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            busy && { opacity: 0.7 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Feather name="log-in" size={18} color={Colors.white} />
              <Text style={styles.buttonText}>Sign in with Google</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 28,
    alignItems: "center",
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
    }),
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  headline: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
    minHeight: 48,
    alignSelf: "stretch",
  },
  buttonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});
