import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getOpenAIClient } from "@/lib/openai";
import { JOURNAL_MEDIA } from "@/lib/constants";
import { z } from "zod";

const bodySchema = z.object({
  mediaId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`audio-transcribe:${user.id}`, 5, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  const { id: entryId } = await params;

  try {
    const body = await request.json();
    const { mediaId } = bodySchema.parse(body);

    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, userId: user.id },
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const media = await prisma.journalMedia.findFirst({
      where: { id: mediaId, entryId, userId: user.id },
    });
    if (!media || !media.mimeType.startsWith("audio/")) {
      return NextResponse.json({ error: "Audio media not found" }, { status: 404 });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "AI not configured. Please add an OpenAI API key." },
        { status: 503 }
      );
    }

    const supabase = getServiceClient();
    const { data: fileData, error: dlError } = await supabase.storage
      .from(JOURNAL_MEDIA.BUCKET_NAME)
      .download(media.storagePath);

    if (dlError || !fileData) {
      console.error("Audio download error:", dlError);
      return NextResponse.json({ error: "Failed to download audio" }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const file = new File([buffer], "audio.webm", { type: "audio/webm" });

    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      language: "en",
    });

    const text = transcription.text?.trim() || "";

    const existingPlain = entry.contentPlainText || "";
    const updatedPlain = existingPlain
      ? `${existingPlain}\n\n[Voice Recording Transcription]\n${text}`
      : text;

    await prisma.journalEntry.update({
      where: { id: entryId },
      data: { contentPlainText: updatedPlain },
    });

    return NextResponse.json({ text, status: "complete" });
  } catch (error) {
    console.error("Audio transcription error:", error);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
