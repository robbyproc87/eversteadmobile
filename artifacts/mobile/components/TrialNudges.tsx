import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { usePlan } from "@/lib/plan";
import { UpgradePrompt } from "@/components/UpgradePrompt";

const FLAG_WELCOME = "everstead_trial_welcome_seen";
const FLAG_TOAST = "everstead_trial_toast_seen";
const FLAG_BANNER = "everstead_trial_banner_dismissed";
const FLAG_EXPIRED = "everstead_trial_expired_seen";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function TrialNudges() {
  const insets = useSafeAreaInsets();
  const plan = usePlan();

  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [expiredOpen, setExpiredOpen] = useState(false);
  const fade = React.useRef(new Animated.Value(0)).current;

  // Day 0 — first-trial welcome
  useEffect(() => {
    if (!plan.isTrial) return;
    AsyncStorage.getItem(FLAG_WELCOME).then((v) => {
      if (v !== "true") setWelcomeOpen(true);
    });
  }, [plan.isTrial]);

  // Day 7-5 toast (once)
  useEffect(() => {
    if (!plan.isTrial) return;
    if (plan.trialDaysLeft < 5 || plan.trialDaysLeft > 7) return;
    AsyncStorage.getItem(FLAG_TOAST).then((v) => {
      if (v === "true") return;
      setToastVisible(true);
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
      const t = setTimeout(() => {
        Animated.timing(fade, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(() => setToastVisible(false));
        AsyncStorage.setItem(FLAG_TOAST, "true").catch(() => {});
      }, 8_000);
      return () => clearTimeout(t);
    });
  }, [plan.isTrial, plan.trialDaysLeft, fade]);

  // Day 2-0 persistent banner (dismissable per-day)
  useEffect(() => {
    if (!plan.isTrial) return;
    if (plan.trialDaysLeft > 2 || plan.trialDaysLeft < 0) return;
    AsyncStorage.getItem(FLAG_BANNER).then((v) => {
      if (v === todayKey()) return;
      setBannerVisible(true);
    });
  }, [plan.isTrial, plan.trialDaysLeft]);

  // Post-expiry modal (once)
  useEffect(() => {
    if (plan.loading) return;
    if (plan.isPro) return;
    if (!plan.trialEndsAt) return;
    const expired = new Date(plan.trialEndsAt).getTime() < Date.now();
    if (!expired) return;
    AsyncStorage.getItem(FLAG_EXPIRED).then((v) => {
      if (v !== "true") setExpiredOpen(true);
    });
  }, [plan.loading, plan.isPro, plan.trialEndsAt]);

  const closeWelcome = () => {
    AsyncStorage.setItem(FLAG_WELCOME, "true").catch(() => {});
    setWelcomeOpen(false);
  };
  const dismissBanner = () => {
    AsyncStorage.setItem(FLAG_BANNER, todayKey()).catch(() => {});
    setBannerVisible(false);
  };
  const closeExpired = () => {
    AsyncStorage.setItem(FLAG_EXPIRED, "true").catch(() => {});
    setExpiredOpen(false);
  };

  return (
    <>
      {welcomeOpen && (
        <Modal transparent animationType="fade" onRequestClose={closeWelcome}>
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <View style={styles.iconWrap}>
                <Feather name="gift" size={22} color={Colors.gold} />
              </View>
              <Text style={styles.modalTitle}>
                Welcome to Everstead Pro Trial
              </Text>
              <Text style={styles.modalBody}>
                You have full access to AI coaches, generated meditations,
                unlimited journaling, and Life Architecture for the next{" "}
                {plan.trialDaysLeft || 14} days.
              </Text>
              <Pressable
                onPress={closeWelcome}
                style={({ pressed }) => [
                  styles.modalCta,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.modalCtaText}>Start exploring</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {toastVisible && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastWrap,
            { top: insets.top + 12, opacity: fade },
          ]}
        >
          <View style={styles.toastCard}>
            <Feather name="clock" size={16} color={Colors.gold} />
            <Text style={styles.toastText}>
              Your trial ends in {plan.trialDaysLeft} day
              {plan.trialDaysLeft === 1 ? "" : "s"}. Keep exploring.
            </Text>
          </View>
        </Animated.View>
      )}

      {bannerVisible && (
        <View
          pointerEvents="box-none"
          style={[styles.bannerWrap, { top: insets.top }]}
        >
          <View style={styles.bannerCard}>
            <Feather name="alert-circle" size={16} color={Colors.dark} />
            <Text style={styles.bannerText}>
              Trial ends{" "}
              {plan.trialDaysLeft <= 0
                ? "today"
                : plan.trialDaysLeft === 1
                  ? "tomorrow"
                  : `in ${plan.trialDaysLeft} days`}
              . Upgrade to keep Pro features.
            </Text>
            <Pressable
              onPress={dismissBanner}
              hitSlop={8}
              accessibilityLabel="Dismiss banner"
            >
              <Feather name="x" size={16} color={Colors.dark} />
            </Pressable>
          </View>
        </View>
      )}

      {expiredOpen && (
        <Modal transparent animationType="fade" onRequestClose={closeExpired}>
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Your trial has expired</Text>
              <Text style={styles.modalBody}>
                Upgrade to continue using AI coaching, generated meditations,
                and other Pro tools.
              </Text>
              <UpgradePrompt variant="full" onSuccess={closeExpired} />
              <Pressable
                onPress={closeExpired}
                style={({ pressed }) => [
                  styles.modalDismiss,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.modalDismissText}>Maybe later</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: Colors.card ?? "#fff",
    borderRadius: 18,
    padding: 22,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.dark,
  },
  modalBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  modalCta: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  modalCtaText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark,
  },
  modalDismiss: {
    paddingVertical: 10,
    alignItems: "center",
  },
  modalDismissText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  toastWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 110,
  },
  toastCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.card ?? "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.gold,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
      web: { boxShadow: "0 3px 12px rgba(0,0,0,0.15)" },
    }),
  },
  toastText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
    flex: 1,
  },
  bannerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 95,
  },
  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.goldLight,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e8d9a6",
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark,
  },
});
