import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`planner-todos:${user.id}`, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { dailyPlanId, text, source } = body;

    if (!dailyPlanId || !text) {
      return NextResponse.json({ error: "dailyPlanId and text are required" }, { status: 400 });
    }

    const plan = await prisma.dailyPlan.findFirst({
      where: { id: dailyPlanId, userId: user.id },
    });
    if (!plan) {
      return NextResponse.json({ error: "Daily plan not found" }, { status: 404 });
    }

    const maxOrdinal = await prisma.dailyPlanTodo.aggregate({
      where: { dailyPlanId },
      _max: { ordinal: true },
    });

    const ordinal = (maxOrdinal._max.ordinal ?? -1) + 1;

    const todo = await prisma.dailyPlanTodo.create({
      data: {
        dailyPlanId,
        text,
        ordinal,
        source: source ?? "manual",
      },
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    console.error("Todo create error:", error);
    return NextResponse.json({ error: "Failed to create todo" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`planner-todos:${user.id}`, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { id, text, completed, ordinal } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const todo = await prisma.dailyPlanTodo.findUnique({
      where: { id },
      include: { dailyPlan: true },
    });
    if (!todo || todo.dailyPlan.userId !== user.id) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (text !== undefined) updateData.text = text;
    if (completed !== undefined) updateData.completed = completed;
    if (ordinal !== undefined) updateData.ordinal = ordinal;

    const updated = await prisma.dailyPlanTodo.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Todo update error:", error);
    return NextResponse.json({ error: "Failed to update todo" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`planner-todos:${user.id}`, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const todo = await prisma.dailyPlanTodo.findUnique({
      where: { id },
      include: { dailyPlan: true },
    });
    if (!todo || todo.dailyPlan.userId !== user.id) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    await prisma.dailyPlanTodo.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Todo delete error:", error);
    return NextResponse.json({ error: "Failed to delete todo" }, { status: 500 });
  }
}
