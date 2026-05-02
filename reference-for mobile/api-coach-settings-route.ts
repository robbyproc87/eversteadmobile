import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    let settings = await prisma.coachSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings) {
      settings = await prisma.coachSettings.create({
        data: { userId: user.id },
      });
    }

    return NextResponse.json({
      id: settings.id,
      proactivityLevel: settings.proactivityLevel,
      accessJournal: settings.accessJournal,
      accessPlanner: settings.accessPlanner,
      accessMeditation: settings.accessMeditation,
      accessBooks: settings.accessBooks,
      accessMood: settings.accessMood,
    });
  } catch (error) {
    console.error("Fetch coach settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    if (typeof body.proactivityLevel === "number") {
      updateData.proactivityLevel = Math.max(0, Math.min(100, body.proactivityLevel));
    }

    const booleanFields = [
      "accessJournal",
      "accessPlanner",
      "accessMeditation",
      "accessBooks",
      "accessMood",
    ] as const;

    for (const field of booleanFields) {
      if (typeof body[field] === "boolean") {
        updateData[field] = body[field];
      }
    }

    const settings = await prisma.coachSettings.upsert({
      where: { userId: user.id },
      update: updateData,
      create: {
        userId: user.id,
        ...updateData,
      },
    });

    return NextResponse.json({
      id: settings.id,
      proactivityLevel: settings.proactivityLevel,
      accessJournal: settings.accessJournal,
      accessPlanner: settings.accessPlanner,
      accessMeditation: settings.accessMeditation,
      accessBooks: settings.accessBooks,
      accessMood: settings.accessMood,
    });
  } catch (error) {
    console.error("Update coach settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
