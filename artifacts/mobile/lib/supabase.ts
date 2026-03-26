import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === "web") {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === "web") {
      try {
        localStorage.setItem(key, value);
      } catch {}
      return;
    }
    return SecureStore.setItemAsync(key, value) as unknown as void;
  },
  removeItem: (key: string) => {
    if (Platform.OS === "web") {
      try {
        localStorage.removeItem(key);
      } catch {}
      return;
    }
    return SecureStore.deleteItemAsync(key) as unknown as void;
  },
};

const envA = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const envB = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

function resolveSupabaseConfig(): { url: string; anonKey: string } {
  const isUrlA = envA.startsWith("https://");
  const isUrlB = envB.startsWith("https://");

  if (isUrlA && !isUrlB) return { url: envA, anonKey: envB };
  if (isUrlB && !isUrlA) return { url: envB, anonKey: envA };

  throw new Error(
    "Supabase configuration error: unable to resolve URL and anon key from environment variables.",
  );
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } =
  resolveSupabaseConfig();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
