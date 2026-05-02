import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  try {
    const meditations = await prisma.generatedMeditation.findMany({
      where: { userId: user.id },
      orderBy: { generatedAt: "desc" },
      take: limit,
    });

    return NextResponse.json(meditations);
  } catch (error) {
    console.error("Fetch generated meditations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch meditations" },
      { status: 500 }
    );
  }
}
