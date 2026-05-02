import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`planner-set-next:${user.id}`, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { currentWeekId, items } = body;

    if (!currentWeekId || !Array.isArray(items)) {
      return NextResponse.json({ error: "currentWeekId and items array are required" }, { status: 400 });
    }

    const currentWeek = await prisma.plannerWeek.findFirst({
      where: { id: currentWeekId, userId: user.id },
    });
    if (!currentWeek) {
      return NextResponse.json({ error: "Current planner week not found" }, { status: 404 });
    }

    const nextWeekStart = new Date(currentWeek.weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);

    let nextWeek = await prisma.plannerWeek.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart: nextWeekStart } },
    });

    if (!nextWeek) {
      nextWeek = await prisma.plannerWeek.create({
        data: { userId: user.id, weekStart: nextWeekStart },
      });
    }

    const results = await Promise.all(
      items.map((item: { category: string; ordinal: number; text: string }) =>
        prisma.trulyExceptional.upsert({
          where: {
            weekId_category_ordinal: {
              weekId: nextWeek.id,
              category: item.category,
              ordinal: item.ordinal,
            },
          },
          create: {
            weekId: nextWeek.id,
            category: item.category,
            ordinal: item.ordinal,
            text: item.text || null,
            source: "review_set",
          },
          update: {
            text: item.text || null,
            source: "review_set",
          },
        })
      )
    );

    return NextResponse.json({ nextWeekId: nextWeek.id, items: results });
  } catch (error) {
    console.error("Set next week TEs error:", error);
    return NextResponse.json({ error: "Failed to set next week's direction" }, { status: 500 });
  }
}
