import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

const DRAWER_WIDTH = 300;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  onOpenSage: () => void;
}

const menuItems = [
  {
    icon: "book",
    label: "Growth Library",
    subtitle: "Books & Courses",
    route: "/growth-library",
  },
  {
    icon: "trending-up",
    label: "Trends",
    subtitle: "Your progress over time",
    route: "/trends",
  },
  {
    icon: "settings",
    label: "Settings",
    subtitle: "Account & preferences",
    route: "/settings",
  },
] as const;

export function AppDrawer({ visible, onClose, onOpenSage }: AppDrawerProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, overlayAnim]);

  const handleNavigate = (route: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  const handleSage = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
    setTimeout(() => {
      onOpenSage();
    }, 100);
  };

  if (!visible && slideAnim._value === -DRAWER_WIDTH) {
    return null;
  }

  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "User";
  const fullName = user?.user_metadata?.full_name || firstName;
  const email = user?.email || "";

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.4],
            }),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top + webTopInset,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
          },
        ]}
      >
        <View style={styles.logoSection}>
          <View style={styles.logoIcon}>
            <Feather name="compass" size={24} color={Colors.gold} />
          </View>
          <Text style={styles.logoText}>Everstead</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Feather name="x" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: Colors.background },
              ]}
              onPress={() => handleNavigate(item.route)}
            >
              <View style={styles.menuItemIcon}>
                <Feather name={item.icon as any} size={18} color={Colors.gold} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemLabel}>{item.label}</Text>
                <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
            </Pressable>
          ))}

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { backgroundColor: Colors.background },
            ]}
            onPress={handleSage}
          >
            <View style={[styles.menuItemIcon, { backgroundColor: Colors.goldLight }]}>
              <Feather name="zap" size={18} color={Colors.gold} />
            </View>
            <View style={styles.menuItemContent}>
              <Text style={styles.menuItemLabel}>Sage</Text>
              <Text style={styles.menuItemSubtitle}>AI Coach</Text>
            </View>
            <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.profileAvatar}>
            <Feather name="user" size={20} color={Colors.gold} />
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: Colors.card,
    borderRightWidth: 1,
    borderRightColor: Colors.cardBorder,
    justifyContent: "space-between",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 16,
      },
      web: {
        boxShadow: "2px 0 20px rgba(0,0,0,0.12)",
      },
    }),
  },
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 10,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  menuSection: {
    flex: 1,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  menuItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  menuItemContent: {
    flex: 1,
    gap: 1,
  },
  menuItemLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
  menuItemSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.separator,
    marginVertical: 8,
    marginHorizontal: 12,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    gap: 12,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.goldLight,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  profileEmail: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
});
