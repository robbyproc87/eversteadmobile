import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { meditationSessionSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limiter";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const sessions = await prisma.meditationSession.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 50,
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Sessions fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`meditation:${user.id}`, 10, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const validated = meditationSessionSchema.parse(body);

    const session = await prisma.meditationSession.create({
      data: {
        userId: user.id,
        trackId: validated.trackId,
        generatedMeditationId: validated.generatedMeditationId,
        meditationType: validated.meditationType,
        startedAt: validated.startedAt ? new Date(validated.startedAt) : new Date(),
        endedAt: validated.endedAt ? new Date(validated.endedAt) : null,
        rating: validated.rating,
        notes: validated.notes,
        tensionBefore: validated.tensionBefore,
        stressBefore: validated.stressBefore,
        attentionQuality: validated.attentionQuality,
        mindWanderingCount: validated.mindWanderingCount,
        emotionalTurbulence: validated.emotionalTurbulence,
        reactivity: validated.reactivity,
        tensionAfter: validated.tensionAfter,
        stressAfter: validated.stressAfter,
        insightText: validated.insightText,
        insightScore: validated.insightScore,
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Session create error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

const updateSessionSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  attentionQuality: z.number().int().min(1).max(5).optional(),
  mindWanderingCount: z.number().int().min(0).max(100).optional(),
  emotionalTurbulence: z.number().int().min(1).max(5).optional(),
  reactivity: z.number().int().min(1).max(5).optional(),
  tensionAfter: z.number().int().min(1).max(10).optional(),
  stressAfter: z.number().int().min(1).max(10).optional(),
  insightText: z.string().max(5000).optional(),
  insightScore: z.number().int().min(0).max(3).optional(),
});

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...rest } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    const existing = await prisma.meditationSession.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const validated = updateSessionSchema.parse(rest);

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(validated)) {
      if (value !== undefined) updateData[key] = value;
    }

    const updated = await prisma.meditationSession.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Session update error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}
