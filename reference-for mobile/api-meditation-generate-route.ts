import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { prisma } from "@/lib/prisma";
import { generateMeditationScript } from "@/lib/meditation/generate-script";
import { generateSpeechAudio } from "@/lib/meditation/text-to-speech";
import { z } from "zod";
import { canAccess } from "@/lib/plan/access";

const VALID_TYPES = [
  "Box Breathing",
  "4-7-8 Breathing",
  "Body Scan",
  "Focused Attention",
  "Loving-Kindness",
  "Open Awareness",
];

const generateSchema = z.object({
  meditationType: z.string().refine((v) => VALID_TYPES.includes(v), {
    message: "Invalid meditation type",
  }),
  durationS: z.number().refine((v) => [300, 600, 1200].includes(v), {
    message: "Duration must be 300, 600, or 1200 seconds",
  }),
  voice: z.string().optional().default("nova"),
});

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const allowed = await canAccess(user.id, "ai_meditation");
  if (!allowed) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 402 });
  }

  try {
    const body = await request.json();
    const validated = generateSchema.parse(body);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.generatedMeditation.count({
      where: {
        userId: user.id,
        generatedAt: { gte: today },
      },
    });

    if (todayCount >= 5) {
      return NextResponse.json(
        { error: "Daily generation limit reached (5 per day)" },
        { status: 429 }
      );
    }

    const scriptText = await generateMeditationScript(
      user.id,
      validated.meditationType,
      validated.durationS
    );

    const audioBuffer = await generateSpeechAudio(scriptText, validated.voice);

    const supabase = getServiceClient();
    const fileName = `${user.id}/${Date.now()}_${validated.meditationType.replace(/\s+/g, "_").toLowerCase()}.mp3`;

    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b: { name: string }) => b.name === "meditations")) {
      await supabase.storage.createBucket("meditations", { public: false });
    }

    const { error: uploadError } = await supabase.storage
      .from("meditations")
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      throw new Error("Failed to upload audio file");
    }

    const record = await prisma.generatedMeditation.create({
      data: {
        userId: user.id,
        meditationType: validated.meditationType,
        durationS: validated.durationS,
        scriptText,
        audioPath: fileName,
        voiceId: validated.voice,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Meditation generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate meditation" },
      { status: 500 }
    );
  }
}
