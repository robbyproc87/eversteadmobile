import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

const DEMO_MODE = process.env.DEMO_MODE === "true";
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";
const DEMO_USER_EMAIL = "demo@elevate.app";

const demoAuthUser = { id: DEMO_USER_ID, email: DEMO_USER_EMAIL };

const demoProfile: Profile = {
  id: DEMO_USER_ID,
  email: DEMO_USER_EMAIL,
  name: "Demo User",
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const demoSessionUser = {
  id: DEMO_USER_ID,
  email: DEMO_USER_EMAIL,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "demo" },
  user_metadata: { full_name: "Demo User" },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as any;

async function getBearerToken(): Promise<string | null> {
  try {
    const headerStore = await headers();
    const authHeader = headerStore.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.slice(7);
    }
  } catch {
  }
  return null;
}

function getBearerTokenFromHeaders(reqHeaders: Headers): string | null {
  const authHeader = reqHeaders.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

function createClientWithToken(token: string): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith("http")) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

export async function createClient(): Promise<SupabaseClient | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
    return null;
  }

  const bearerToken = await getBearerToken();
  if (bearerToken) {
    return createClientWithToken(bearerToken);
  }

  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
          }
        },
      },
    }
  );
}

export async function getAuthUser(): Promise<{ id: string; email?: string } | null> {
  if (DEMO_MODE) return demoAuthUser;

  const supabase = await createClient();
  if (!supabase) return null;
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  
  return { id: user.id, email: user.email };
}

export async function getAuthUserFromRequest(requestOrHeaders: Request | Headers): Promise<{ id: string; email?: string } | null> {
  if (DEMO_MODE) return demoAuthUser;

  const hdrs = requestOrHeaders instanceof Headers
    ? requestOrHeaders
    : new Headers(requestOrHeaders.headers);
  const token = getBearerTokenFromHeaders(hdrs);
  if (!token) return null;

  const supabase = createClientWithToken(token);
  if (!supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return { id: user.id, email: user.email };
}

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function getSessionUser() {
  if (DEMO_MODE) return demoSessionUser;

  const supabase = await createClient();
  if (!supabase) return null;
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  
  return user;
}

export async function getProfile(userId: string, client?: SupabaseClient): Promise<Profile | null> {
  const supabase = client || await createClient();
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  
  if (error || !data) return null;
  
  return data as Profile;
}

export async function getSessionUserWithProfile() {
  if (DEMO_MODE) return { user: demoSessionUser, profile: demoProfile };

  const supabase = await createClient();
  if (!supabase) return { user: null, profile: null };
  
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, profile: null };
  
  const profile = await getProfile(user.id, supabase);
  
  return { user, profile };
}

export async function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey || !supabaseUrl.startsWith('http')) {
    return null;
  }

  return createServerClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      cookies: {
        get() { return undefined; },
        set() {},
        remove() {},
      },
    }
  );
}
