import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getAuthUser();
  

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const tracks = await prisma.meditationTrack.findMany({
      orderBy: { durationS: "asc" },
    });

    return NextResponse.json(tracks);
  } catch (error) {
    console.error("Tracks fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 });
  }
}
