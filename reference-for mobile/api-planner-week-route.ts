import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const weekStartParam = request.nextUrl.searchParams.get("weekStart");
    if (!weekStartParam) {
      return NextResponse.json({ error: "weekStart query parameter is required" }, { status: 400 });
    }

    const weekStart = new Date(weekStartParam + "T00:00:00.000Z");
    if (isNaN(weekStart.getTime())) {
      return NextResponse.json({ error: "Invalid weekStart date" }, { status: 400 });
    }

    let week = await prisma.plannerWeek.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart } },
      include: {
        trulyExceptionals: true,
        weeklyStoryDays: true,
        weeklyStoryObservation: true,
      },
    });

    if (!week) {
      week = await prisma.plannerWeek.create({
        data: { userId: user.id, weekStart },
        include: {
          trulyExceptionals: true,
          weeklyStoryDays: true,
          weeklyStoryObservation: true,
        },
      });
    }

    return NextResponse.json(week);
  } catch (error) {
    console.error("Planner week fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch planner week" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`planner-week:${user.id}`, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.plannerWeek.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Planner week not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (fields.wdsNotes !== undefined) updateData.wdsNotes = fields.wdsNotes;
    if (fields.weekScore !== undefined) updateData.weekScore = fields.weekScore;
    if (fields.weeklyReviewInsights !== undefined) updateData.weeklyReviewInsights = fields.weeklyReviewInsights;

    const updated = await prisma.plannerWeek.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Planner week update error:", error);
    return NextResponse.json({ error: "Failed to update planner week" }, { status: 500 });
  }
}
