import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`journal-transcribe:${user.id}`, 5, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  let parsedEntryId: string | null = null;
  let markedPending = false;

  try {
    const body = await request.json();
    const { entryId, pages } = body as { entryId: string; pages: string[] };
    parsedEntryId = entryId;

    if (!entryId || !Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json({ error: "entryId and pages[] required" }, { status: 400 });
    }

    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, userId: user.id },
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await prisma.journalEntry.update({
      where: { id: entryId },
      data: { transcriptionStatus: "pending" },
    });
    markedPending = true;

    const transcriptions: string[] = [];
    let pagesProcessed = 0;
    let pagesFailed = 0;

    for (const dataUrl of pages) {
      const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!base64Match) continue;
      const base64Data = base64Match[1];

      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: base64Data },
              },
              {
                type: "text",
                text: "Please transcribe any handwritten text in this image. Return only the transcribed text, preserving line breaks and paragraph structure. If there is no legible text, return an empty string.",
              },
            ],
          }],
        });

        pagesProcessed++;
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();
        if (text) transcriptions.push(text);
      } catch (err) {
        pagesFailed++;
        console.error("Vision transcription error for page:", err);
      }
    }

    const allFailed = pagesProcessed === 0 && pagesFailed > 0;
    const fullText = transcriptions.join("\n\n");
    const status = allFailed ? "failed" : "complete";

    await prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        contentPlainText: fullText || null,
        transcriptionStatus: status,
      },
    });

    if (allFailed) {
      return NextResponse.json({ error: "All pages failed to transcribe", status }, { status: 500 });
    }
    return NextResponse.json({ text: fullText, status });
  } catch (error) {
    console.error("Transcription route error:", error);
    if (markedPending && parsedEntryId) {
      try {
        await prisma.journalEntry.update({
          where: { id: parsedEntryId },
          data: { transcriptionStatus: "failed" },
        });
      } catch {}
    }
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
