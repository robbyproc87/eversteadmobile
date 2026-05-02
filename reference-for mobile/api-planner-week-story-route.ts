import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`planner-story:${user.id}`, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { weekId, days } = body;

    if (!weekId || !Array.isArray(days)) {
      return NextResponse.json({ error: "weekId and days array are required" }, { status: 400 });
    }

    const week = await prisma.plannerWeek.findFirst({
      where: { id: weekId, userId: user.id },
    });
    if (!week) {
      return NextResponse.json({ error: "Planner week not found" }, { status: 404 });
    }

    const results = await Promise.all(
      days.map((day: { dayOfWeek: number; narrative?: string; aiSuggested?: boolean }) =>
        prisma.weeklyStoryDay.upsert({
          where: {
            weekId_dayOfWeek: {
              weekId,
              dayOfWeek: day.dayOfWeek,
            },
          },
          create: {
            weekId,
            dayOfWeek: day.dayOfWeek,
            narrative: day.narrative ?? null,
            aiSuggested: day.aiSuggested ?? false,
          },
          update: {
            narrative: day.narrative ?? null,
            aiSuggested: day.aiSuggested ?? false,
          },
        })
      )
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("Weekly story days upsert error:", error);
    return NextResponse.json({ error: "Failed to upsert weekly story days" }, { status: 500 });
  }
}
