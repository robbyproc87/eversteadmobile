import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

export default function LoginScreen() {
  const { session, loading, signInWithGoogle, devBypass } = useAuth();
  const insets = useSafeAreaInsets();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { paddingTop: insets.top + webTopInset },
        ]}
      >
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(e?.message || "Sign in failed. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTopInset,
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Feather name="compass" size={48} color={Colors.gold} />
          </View>
          <Text style={styles.appName}>Everstead</Text>
          <Text style={styles.tagline}>
            Your steadfast companion for{"\n"}mindful growth
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          {error && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              isSigningIn && { opacity: 0.7 },
            ]}
            onPress={handleSignIn}
            disabled={isSigningIn}
          >
            {isSigningIn ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Feather name="log-in" size={20} color={Colors.white} />
                <Text style={styles.googleButtonText}>
                  Sign in with Google
                </Text>
              </>
            )}
          </Pressable>
          {__DEV__ && (
            <Pressable
              style={({ pressed }) => [
                styles.previewButton,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={devBypass}
            >
              <Feather name="eye" size={22} color={Colors.dark} />
              <Text style={styles.previewButtonText}>Preview Mode</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Open privacy policy"
            onPress={async () => {
              const url = "https://my.everstead.app/privacy";
              try {
                if (Platform.OS === "web") {
                  await Linking.openURL(url);
                } else {
                  await WebBrowser.openBrowserAsync(url);
                }
              } catch {
                Linking.openURL(url).catch(() => {});
              }
            }}
            hitSlop={8}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.privacyLink}>Privacy Policy</Text>
          </Pressable>
        </View>
        <Text style={styles.versionText}>
          {`v${Constants.expoConfig?.version ?? "1.0"}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  logoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  appName: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.error,
    flex: 1,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  previewButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  versionText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
    marginTop: 8,
  },
  privacyLink: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    textDecorationLine: "underline",
    marginTop: 4,
  },
});
