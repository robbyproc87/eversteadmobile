import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { getCoach } from "@/lib/coach";
import {
  pathnameToPageName,
  selectNudge,
  type NudgeMessage,
} from "@/lib/nudge-engine";

const AUTO_DISMISS_MS = 15_000;
const FETCH_DELAY_MS = 3_000;
const COOLDOWN_MS = 60_000;

export function NudgeToast() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const isPreview = session?.access_token === "dev-bypass";

  const [nudge, setNudge] = useState<NudgeMessage | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastShownAt = useRef(0);
  const lastFetchKey = useRef<string | null>(null);

  const dismiss = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setNudge(null));
  }, [fadeAnim]);

  useEffect(() => {
    if (!session || isPreview) return;
    const page = pathnameToPageName(pathname ?? "/");
    if (!page) return; // skip on /sage
    const fetchKey = `${pathname}-${Date.now() - (Date.now() % 30000)}`;
    if (lastFetchKey.current === fetchKey) return;
    lastFetchKey.current = fetchKey;

    const t = setTimeout(async () => {
      try {
        if (Date.now() - lastShownAt.current < COOLDOWN_MS) return;
        const resp = await api.getNudge(page);
        const selected = selectNudge(resp.context, resp.proactivityLevel);
        if (!selected) return;
        setNudge(selected);
        lastShownAt.current = Date.now();
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      } catch {
        // silent
      }
    }, FETCH_DELAY_MS);

    return () => clearTimeout(t);
  }, [pathname, session, isPreview, fadeAnim]);

  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [nudge, dismiss]);

  if (!nudge) return null;
  const coach = getCoach(nudge.coachId);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom: insets.bottom + 80, opacity: fadeAnim },
      ]}
    >
      <View style={[styles.card, { borderLeftColor: coach.color }]}>
        <View
          style={[styles.orb, { backgroundColor: coach.color }]}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.coachName}>{coach.name}</Text>
          <Text style={styles.text}>{nudge.text}</Text>
          {nudge.cta ? (
            <Pressable
              onPress={() => {
                dismiss();
                try {
                  router.push(nudge.cta!.route as never);
                } catch {
                  // ignore
                }
              }}
              style={({ pressed }) => [
                styles.cta,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.ctaText, { color: coach.color }]}>
                {nudge.cta.label}
              </Text>
              <Feather name="arrow-right" size={13} color={coach.color} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={dismiss}
          style={styles.closeBtn}
          accessibilityLabel="Dismiss nudge"
        >
          <Feather name="x" size={16} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: Colors.card ?? "#fff",
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 3,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      web: { boxShadow: "0 4px 16px rgba(0,0,0,0.15)" },
    }),
  },
  orb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 2,
  },
  coachName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  text: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark,
    lineHeight: 19,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  ctaText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: {
    padding: 4,
  },
});
