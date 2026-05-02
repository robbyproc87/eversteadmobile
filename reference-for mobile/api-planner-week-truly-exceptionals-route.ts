import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`planner-te:${user.id}`, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { weekId, items } = body;

    if (!weekId || !Array.isArray(items)) {
      return NextResponse.json({ error: "weekId and items array are required" }, { status: 400 });
    }

    const week = await prisma.plannerWeek.findFirst({
      where: { id: weekId, userId: user.id },
    });
    if (!week) {
      return NextResponse.json({ error: "Planner week not found" }, { status: 404 });
    }

    const results = await Promise.all(
      items.map((item: { category: string; ordinal: number; text?: string; source?: string; status?: string; importance?: string }) =>
        prisma.trulyExceptional.upsert({
          where: {
            weekId_category_ordinal: {
              weekId,
              category: item.category,
              ordinal: item.ordinal,
            },
          },
          create: {
            weekId,
            category: item.category,
            ordinal: item.ordinal,
            text: item.text ?? null,
            source: item.source ?? "review_set",
            status: item.status ?? null,
            importance: item.importance ?? null,
          },
          update: {
            text: item.text ?? null,
            source: item.source ?? "review_set",
            status: item.status ?? null,
            importance: item.importance ?? null,
          },
        })
      )
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("Truly exceptionals upsert error:", error);
    return NextResponse.json({ error: "Failed to upsert truly exceptionals" }, { status: 500 });
  }
}
