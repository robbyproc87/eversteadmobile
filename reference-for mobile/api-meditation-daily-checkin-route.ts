import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const checkinSchema = z.object({
  awarenessRating: z.number().int().min(1).max(5),
  wellbeingRating: z.number().int().min(1).max(10),
});

function getTodayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const today = getTodayDate();
    const checkin = await prisma.dailyMindfulness.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
    });

    return NextResponse.json(checkin);
  } catch (error) {
    console.error("Fetch daily checkin error:", error);
    return NextResponse.json(
      { error: "Failed to fetch check-in" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = checkinSchema.parse(body);
    const today = getTodayDate();

    const checkin = await prisma.dailyMindfulness.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
      create: {
        userId: user.id,
        date: today,
        awarenessRating: validated.awarenessRating,
        wellbeingRating: validated.wellbeingRating,
      },
      update: {
        awarenessRating: validated.awarenessRating,
        wellbeingRating: validated.wellbeingRating,
      },
    });

    return NextResponse.json(checkin);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Save daily checkin error:", error);
    return NextResponse.json(
      { error: "Failed to save check-in" },
      { status: 500 }
    );
  }
}
