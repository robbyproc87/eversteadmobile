import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

// SecureStore warns and can silently fail above 2048 bytes on some Android
// versions, and a Supabase session (two JWTs + user metadata) routinely
// exceeds that. Values larger than CHUNK_SIZE are split across
// `${key}.0..n` entries behind a manifest marker stored at `key`.
// Values written by older builds (no marker) read back unchanged.
const CHUNK_SIZE = 1800;
const CHUNK_MARKER = "__chunked__:";

function chunkCountFrom(head: string | null): number {
  if (!head || !head.startsWith(CHUNK_MARKER)) return 0;
  const n = parseInt(head.slice(CHUNK_MARKER.length), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function getChunked(key: string): Promise<string | null> {
  const head = await SecureStore.getItemAsync(key);
  if (head == null || !head.startsWith(CHUNK_MARKER)) return head;
  const count = chunkCountFrom(head);
  if (count === 0) return null;
  const parts = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      SecureStore.getItemAsync(`${key}.${i}`),
    ),
  );
  if (parts.some((p) => p == null)) return null;
  return parts.join("");
}

async function setChunked(key: string, value: string): Promise<void> {
  const prevCount = chunkCountFrom(await SecureStore.getItemAsync(key));
  const newCount =
    value.length <= CHUNK_SIZE ? 0 : Math.ceil(value.length / CHUNK_SIZE);

  if (newCount === 0) {
    await SecureStore.setItemAsync(key, value);
  } else {
    for (let i = 0; i < newCount; i++) {
      await SecureStore.setItemAsync(
        `${key}.${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
    // Write the manifest last so a partially written value is never visible.
    await SecureStore.setItemAsync(key, `${CHUNK_MARKER}${newCount}`);
  }

  for (let i = newCount; i < prevCount; i++) {
    try {
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    } catch {
      // stale chunk cleanup is best-effort
    }
  }
}

async function removeChunked(key: string): Promise<void> {
  const head = await SecureStore.getItemAsync(key);
  await SecureStore.deleteItemAsync(key);
  const count = chunkCountFrom(head);
  for (let i = 0; i < count; i++) {
    try {
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    } catch {
      // best-effort
    }
  }
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === "web") {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return getChunked(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === "web") {
      try {
        localStorage.setItem(key, value);
      } catch {}
      return;
    }
    return setChunked(key, value) as unknown as void;
  },
  removeItem: (key: string) => {
    if (Platform.OS === "web") {
      try {
        localStorage.removeItem(key);
      } catch {}
      return;
    }
    return removeChunked(key) as unknown as void;
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

// supabase-js's refresh timer only ticks reliably while the app is
// foregrounded. Drive it from AppState (the documented React Native
// pattern) so tokens refresh on resume instead of expiring mid-session.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
  supabase.auth.startAutoRefresh();
}
