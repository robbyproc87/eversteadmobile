import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

export default function SettingsScreen() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}

function SettingsContent() {
  const { user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (Platform.OS === "web") {
      setIsSigningOut(true);
      await signOut();
      return;
    }

    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setIsSigningOut(true);
          if (Platform.OS !== "web")
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          await signOut();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Feather name="user" size={28} color={Colors.gold} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>
            {user?.user_metadata?.full_name || "User"}
          </Text>
          <Text style={styles.profileEmail} numberOfLines={1}>
            {user?.email || ""}
          </Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <MenuItem icon="bell" label="Notifications" />
        <MenuItem icon="shield" label="Privacy" />
        <MenuItem icon="help-circle" label="Help & Support" isLast />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && { opacity: 0.8 },
          isSigningOut && { opacity: 0.5 },
        ]}
        onPress={handleSignOut}
        disabled={isSigningOut}
      >
        <Feather name="log-out" size={18} color={Colors.error} />
        <Text style={styles.signOutText}>
          {isSigningOut ? "Signing out\u2026" : "Sign Out"}
        </Text>
      </Pressable>

      <Text style={styles.versionText}>Everstead v1.0.0</Text>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  label,
  isLast,
}: {
  icon: string;
  label: string;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        !isLast && styles.menuItemBorder,
        pressed && { backgroundColor: Colors.background },
      ]}
    >
      <View style={styles.menuItemIconWrap}>
        <Feather name={icon as any} size={18} color={Colors.textSecondary} />
      </View>
      <Text style={styles.menuItemLabel}>{label}</Text>
      <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },
  profileCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  menuItemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  signOutText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.error,
  },
  versionText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    textAlign: "center",
  },
});
