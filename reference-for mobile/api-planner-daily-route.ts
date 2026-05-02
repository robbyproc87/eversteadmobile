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
    const dateParam = request.nextUrl.searchParams.get("date");
    if (!dateParam) {
      return NextResponse.json({ error: "date query parameter is required" }, { status: 400 });
    }

    const date = new Date(dateParam + "T00:00:00.000Z");
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const includeRelations = {
      todos: { orderBy: { ordinal: "asc" as const } },
      priorities: { orderBy: { ordinal: "asc" as const } },
      wentWells: { orderBy: { ordinal: "asc" as const } },
      gratitudes: { orderBy: { ordinal: "asc" as const } },
    };

    let plan = await prisma.dailyPlan.findUnique({
      where: { userId_date: { userId: user.id, date } },
      include: includeRelations,
    });

    if (!plan) {
      plan = await prisma.dailyPlan.create({
        data: { userId: user.id, date },
        include: includeRelations,
      });
    }

    if (plan.gratitudes.length === 0) {
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const legacyGratitudes = await prisma.gratitudeEntry.findMany({
        where: {
          userId: user.id,
          date: { gte: startOfDay, lt: endOfDay },
        },
        orderBy: { createdAt: "asc" },
        take: 6,
      });

      if (legacyGratitudes.length > 0) {
        (plan as any).gratitudes = legacyGratitudes.map((g, i) => ({
          id: g.id,
          dailyPlanId: plan!.id,
          ordinal: i + 1,
          text: g.text,
          createdAt: g.createdAt,
          updatedAt: g.createdAt,
          _legacy: true,
        }));
      }
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Daily plan fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch daily plan" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`planner-daily:${user.id}`, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { id, dailyGoal } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.dailyPlan.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Daily plan not found" }, { status: 404 });
    }

    const updated = await prisma.dailyPlan.update({
      where: { id },
      data: { dailyGoal },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Daily plan update error:", error);
    return NextResponse.json({ error: "Failed to update daily plan" }, { status: 500 });
  }
}
