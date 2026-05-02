import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuthUser } from "@/lib/supabase/server";

export async function requireUser() {
  const user = await getAuthUser();

  if (!user) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "/";
    redirect(`/auth/login?next=${encodeURIComponent(pathname)}`);
  }

  return user;
}
