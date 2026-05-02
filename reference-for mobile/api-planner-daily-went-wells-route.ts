import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`planner-wentwells:${user.id}`, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { dailyPlanId, items } = body;

    if (!dailyPlanId || !Array.isArray(items)) {
      return NextResponse.json({ error: "dailyPlanId and items array are required" }, { status: 400 });
    }

    const plan = await prisma.dailyPlan.findFirst({
      where: { id: dailyPlanId, userId: user.id },
    });
    if (!plan) {
      return NextResponse.json({ error: "Daily plan not found" }, { status: 404 });
    }

    const results = await Promise.all(
      items.map((item: { ordinal: number; text?: string }) =>
        prisma.dailyPlanWentWell.upsert({
          where: {
            dailyPlanId_ordinal: {
              dailyPlanId,
              ordinal: item.ordinal,
            },
          },
          create: {
            dailyPlanId,
            ordinal: item.ordinal,
            text: item.text ?? null,
          },
          update: {
            text: item.text ?? null,
          },
        })
      )
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("Went wells upsert error:", error);
    return NextResponse.json({ error: "Failed to upsert went wells" }, { status: 500 });
  }
}
