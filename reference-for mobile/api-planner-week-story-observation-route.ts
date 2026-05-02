import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`planner-obs:${user.id}`, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { weekId, content } = body;

    if (!weekId) {
      return NextResponse.json({ error: "weekId is required" }, { status: 400 });
    }

    const week = await prisma.plannerWeek.findFirst({
      where: { id: weekId, userId: user.id },
    });
    if (!week) {
      return NextResponse.json({ error: "Planner week not found" }, { status: 404 });
    }

    const observation = await prisma.weeklyStoryObservation.upsert({
      where: { weekId },
      create: {
        weekId,
        content: content ?? null,
      },
      update: {
        content: content ?? null,
      },
    });

    return NextResponse.json(observation);
  } catch (error) {
    console.error("Weekly story observation upsert error:", error);
    return NextResponse.json({ error: "Failed to upsert weekly story observation" }, { status: 500 });
  }
}
