import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { AppDrawer } from "@/components/AppDrawer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SageOrb } from "@/components/SageOrb";
import { NudgeToast } from "@/components/coach/NudgeToast";
import { TrialNudges } from "@/components/TrialNudges";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DrawerProvider, useDrawer } from "@/contexts/DrawerContext";
import { ToastProvider } from "@/contexts/ToastContext";
import Colors from "@/constants/colors";
import { api } from "@/lib/api";
import { refreshRitualSchedules } from "@/lib/notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const { session } = useAuth();
  const { drawerOpen, closeDrawer } = useDrawer();

  const isSageOpen = segments.includes("sage" as never);
  const isLoginScreen = segments.includes("login" as never);
  const isOnboarding = segments.includes("onboarding" as never);
  const isJournalScreen =
    segments.includes("journal" as never) ||
    segments.includes("journal-entry" as never);
  const showOrb =
    session && !isSageOpen && !isLoginScreen && !isJournalScreen && !isOnboarding;

  const onboardingQuery = useQuery({
    queryKey: ["onboarding"],
    queryFn: api.getOnboardingState,
    enabled: !!session && !isLoginScreen,
    retry: 0,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!session) return;
    if (isLoginScreen || isOnboarding) return;
    const data = onboardingQuery.data;
    if (!data) return;
    if (data.onboardingComplete === false) {
      router.replace("/onboarding");
    }
  }, [session, isLoginScreen, isOnboarding, onboardingQuery.data, router]);

  // Top up the 7-day ritual notification queue and route taps.
  useEffect(() => {
    if (Platform.OS === "web") return;
    refreshRitualSchedules();
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url;
        if (typeof url === "string") {
          router.push(url as never);
        }
      },
    );
    return () => sub.remove();
  }, [router]);

  return (
    <>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.dark,
          contentStyle: { backgroundColor: Colors.background },
          headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="sage"
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="growth-library"
          options={{ title: "Growth Library" }}
        />
        <Stack.Screen name="trends" options={{ title: "Trends" }} />
        <Stack.Screen
          name="life-architecture"
          options={{ title: "Life Architecture" }}
        />
        <Stack.Screen
          name="life-architecture-section"
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen
          name="journal-entry"
          options={{ headerShown: false, animation: "slide_from_right" }}
        />
      </Stack>
      {showOrb && <SageOrb />}
      {session && !isSageOpen && !isLoginScreen && !isOnboarding && (
        <>
          <NudgeToast />
          <TrialNudges />
        </>
      )}
      <AppDrawer
        visible={drawerOpen}
        onClose={closeDrawer}
        onOpenSage={() => router.push("/sage")}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <DrawerProvider>
              <ToastProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <RootLayoutContent />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </ToastProvider>
            </DrawerProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
