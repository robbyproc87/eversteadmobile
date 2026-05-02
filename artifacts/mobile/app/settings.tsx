import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AuthGuard } from "@/components/AuthGuard";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  type BillingStatus,
  api,
  integrationsApi,
  normalizeImageUrl,
} from "@/lib/api";

const PRIVACY_URL = "https://my.everstead.app/privacy";

interface IntegrationStatus {
  connected: boolean;
  reason?: string;
}

export default function SettingsScreen() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}

function SettingsContent() {
  const { user, signOut } = useAuth();
  const { showError } = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [calendar, setCalendar] = useState<IntegrationStatus | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else {
        setBillingLoading(true);
        setCalendarLoading(true);
      }
      const [billingRes, calRes] = await Promise.allSettled([
        api.getBillingStatus(),
        integrationsApi.getCalendarStatus(),
      ]);
      if (billingRes.status === "fulfilled") {
        setBilling(billingRes.value ?? null);
        setBillingError(null);
      } else {
        const err = billingRes.reason;
        setBilling(null);
        setBillingError(
          err instanceof Error ? err.message : "Could not load billing",
        );
      }
      if (calRes.status === "fulfilled") {
        setCalendar(calRes.value);
      } else {
        setCalendar({ connected: false, reason: "Unknown" });
      }
      setBillingLoading(false);
      setCalendarLoading(false);
      setRefreshing(false);
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSignOut = async () => {
    if (Platform.OS === "web") {
      setIsSigningOut(true);
      try {
        await signOut();
      } catch (e) {
        setIsSigningOut(false);
        showError(e instanceof Error ? e.message : "Could not sign out");
      }
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
          try {
            await signOut();
          } catch (e) {
            setIsSigningOut(false);
            showError(e instanceof Error ? e.message : "Could not sign out");
          }
        },
      },
    ]);
  };

  const openPrivacy = async () => {
    try {
      await Linking.openURL(PRIVACY_URL);
    } catch {
      showError("Could not open Privacy Policy");
    }
  };

  const appVersion =
    Constants.expoConfig?.version ??
    (Constants.manifest as { version?: string } | null)?.version ??
    "1.0.0";
  const buildNumber =
    Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode?.toString();

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    "User";
  const avatarUrl = normalizeImageUrl(
    (user?.user_metadata?.avatar_url as string | undefined) ||
      (user?.user_metadata?.picture as string | undefined),
  );
  const email = user?.email ?? "";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={Colors.gold}
        />
      }
    >
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatarImg}
              contentFit="cover"
            />
          ) : (
            <Feather name="user" size={28} color={Colors.gold} />
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>
            {fullName}
          </Text>
          <Text style={styles.profileEmail} numberOfLines={1}>
            {email}
          </Text>
        </View>
      </View>

      <SectionHeader label="Subscription" />
      <View style={styles.sectionCard}>
        <BillingRow
          loading={billingLoading}
          billing={billing}
          error={billingError}
        />
      </View>

      <SectionHeader label="Integrations" />
      <View style={styles.sectionCard}>
        <CalendarRow loading={calendarLoading} status={calendar} />
      </View>

      <SectionHeader label="About" />
      <View style={styles.sectionCard}>
        <MenuItem
          icon="shield"
          label="Privacy Policy"
          rightIcon="external-link"
          onPress={openPrivacy}
        />
        <MenuRow
          icon="info"
          label="App version"
          value={
            buildNumber
              ? `${appVersion} (${buildNumber})`
              : appVersion
          }
          isLast
        />
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

      <Text style={styles.versionText}>Everstead</Text>
    </ScrollView>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function BillingRow({
  loading,
  billing,
  error,
}: {
  loading: boolean;
  billing: BillingStatus | null;
  error: string | null;
}) {
  if (loading) {
    return (
      <View style={[styles.menuItem, { justifyContent: "center" }]}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  if (error || !billing) {
    return (
      <View style={styles.menuItem}>
        <View style={styles.menuItemIconWrap}>
          <Feather name="credit-card" size={18} color={Colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuItemLabel}>Subscription</Text>
          <Text style={styles.menuItemSub}>
            {error ?? "Status unavailable"}
          </Text>
        </View>
      </View>
    );
  }

  const planName = formatPlanName(billing.plan);
  const isActive = billing.active === true;
  const trialMsg =
    billing.trialEndsAt && !isActive
      ? `Trial ends ${formatDate(billing.trialEndsAt)}`
      : undefined;
  const statusLabel = isActive ? "Active" : trialMsg ?? "Inactive";
  const statusColor = isActive
    ? Colors.success
    : trialMsg
      ? Colors.gold
      : Colors.textSecondary;

  return (
    <View style={styles.menuItem}>
      <View style={styles.menuItemIconWrap}>
        <Feather name="credit-card" size={18} color={Colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuItemLabel}>{planName}</Text>
        <Text style={[styles.menuItemSub, { color: statusColor }]}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
}

function CalendarRow({
  loading,
  status,
}: {
  loading: boolean;
  status: IntegrationStatus | null;
}) {
  if (loading) {
    return (
      <View style={[styles.menuItem, { justifyContent: "center" }]}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }
  const connected = status?.connected ?? false;
  return (
    <View style={styles.menuItem}>
      <View
        style={[
          styles.menuItemIconWrap,
          connected && { backgroundColor: Colors.goldLight },
        ]}
      >
        <Feather
          name="calendar"
          size={18}
          color={connected ? Colors.gold : Colors.textSecondary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuItemLabel}>Calendar</Text>
        <Text
          style={[
            styles.menuItemSub,
            { color: connected ? Colors.success : Colors.textSecondary },
          ]}
        >
          {connected ? "Connected" : status?.reason ?? "Not connected"}
        </Text>
        {!connected ? (
          <Text style={styles.menuItemHint}>
            Manage on the web at my.everstead.app
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  rightIcon,
  onPress,
  isLast,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  rightIcon?: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        !isLast && styles.menuItemBorder,
        pressed && onPress && { backgroundColor: Colors.background },
      ]}
    >
      <View style={styles.menuItemIconWrap}>
        <Feather name={icon} size={18} color={Colors.textSecondary} />
      </View>
      <Text style={styles.menuItemLabel}>{label}</Text>
      <Feather
        name={rightIcon ?? "chevron-right"}
        size={18}
        color={Colors.textTertiary}
      />
    </Pressable>
  );
}

function MenuRow({
  icon,
  label,
  value,
  isLast,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.menuItem, !isLast && styles.menuItemBorder]}>
      <View style={styles.menuItemIconWrap}>
        <Feather name={icon} size={18} color={Colors.textSecondary} />
      </View>
      <Text style={styles.menuItemLabel}>{label}</Text>
      <Text style={styles.menuItemValue}>{value}</Text>
    </View>
  );
}

function formatPlanName(plan?: string): string {
  if (!plan) return "Free plan";
  const lower = plan.toLowerCase();
  if (lower === "free") return "Free plan";
  if (lower === "pro" || lower === "premium") return "Pro plan";
  if (lower === "trial") return "Pro trial";
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} plan`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
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
    gap: 8,
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
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
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
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
    marginLeft: 4,
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
  menuItemSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuItemHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
  menuItemValue: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
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
    marginTop: 16,
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
    marginTop: 12,
  },
});
