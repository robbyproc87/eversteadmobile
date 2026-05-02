import { requireUser } from "@/lib/auth/requireUser";
import { getProfile } from "@/lib/supabase/server";
import { CoachPage } from "@/components/coach/CoachPage";
import { CoachIntroDialog } from "@/components/coach/CoachIntroFlow";

export const dynamic = "force-dynamic";

export default async function CoachRoute() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <div className="h-[calc(100vh-4rem)] md:h-screen">
      <CoachPage userName={profile?.name || undefined} />
      <CoachIntroDialog />
    </div>
  );
}
