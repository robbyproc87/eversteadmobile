import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";

export type ToastVariant = "error" | "success" | "info";

interface ToastOptions {
  variant?: ToastVariant;
  duration?: number;
}

interface ToastInternal {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  showError: () => {},
  showSuccess: () => {},
});

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  error: 4000,
  success: 2500,
  info: 3000,
};

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastInternal[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const variant = options?.variant ?? "info";
      const duration = options?.duration ?? DEFAULT_DURATION[variant];
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
    },
    [],
  );

  const showError = useCallback(
    (message: string) => showToast(message, { variant: "error" }),
    [showToast],
  );

  const showSuccess = useCallback(
    (message: string) => showToast(message, { variant: "success" }),
    [showToast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, showError, showSuccess }),
    [showToast, showError, showSuccess],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

interface ToastHostProps {
  toasts: ToastInternal[];
  onDismiss: (id: number) => void;
}

function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        { paddingTop: insets.top + webTopInset + 8 },
      ]}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

interface ToastItemProps {
  toast: ToastInternal;
  onDismiss: (id: number) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(translate, {
          toValue: -12,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss(toast.id));
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [opacity, translate, toast.duration, toast.id, onDismiss]);

  const handlePress = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: -12,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(toast.id));
  };

  const palette = variantPalette(toast.variant);

  return (
    <Animated.View
      style={[
        styles.toastWrap,
        {
          opacity,
          transform: [{ translateY: translate }],
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.toast,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: palette.iconBg }]}>
          <Feather name={palette.icon} size={14} color={palette.iconColor} />
        </View>
        <Text style={[styles.message, { color: palette.text }]} numberOfLines={3}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function variantPalette(variant: ToastVariant): {
  background: string;
  border: string;
  text: string;
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
} {
  if (variant === "error") {
    return {
      background: "#fdecea",
      border: "#f5c6c2",
      text: "#7a1f1a",
      icon: "alert-circle",
      iconBg: "#f9d6d3",
      iconColor: Colors.error,
    };
  }
  if (variant === "success") {
    return {
      background: "#e8f5ee",
      border: "#c3e2cf",
      text: "#234c36",
      icon: "check-circle",
      iconBg: "#d1ead9",
      iconColor: Colors.success,
    };
  }
  return {
    background: Colors.goldLight,
    border: Colors.gold,
    text: Colors.dark,
    icon: "info",
    iconBg: Colors.card,
    iconColor: Colors.goldDark,
  };
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 1000,
    elevation: 1000,
  },
  toastWrap: {
    width: "100%",
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 520,
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
});
