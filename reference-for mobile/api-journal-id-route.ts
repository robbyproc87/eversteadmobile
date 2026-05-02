import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { journalEntrySchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limiter";
import { plainTextToTiptapDoc, tiptapDocToPlainText, isValidTiptapDoc } from "@/lib/journal/tiptap-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const entry = await prisma.journalEntry.findFirst({
      where: { id, userId: user.id },
      include: {
        media: {
          select: { id: true, storagePath: true, mimeType: true, durationS: true },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { media: true } },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
    const contentRich = isValidTiptapDoc(entry.contentRich)
      ? entry.contentRich
      : entry.content
        ? plainTextToTiptapDoc(entry.content)
        : EMPTY_DOC;

    const derivedPlainText =
      entry.contentPlainText ||
      entry.content ||
      (isValidTiptapDoc(entry.contentRich) ? tiptapDocToPlainText(entry.contentRich) : "") ||
      "";

    return NextResponse.json({
      ...entry,
      contentRich,
      contentPlainText: derivedPlainText,
      hasMedia: entry._count.media > 0,
      mediaCount: entry._count.media,
      media: entry.media.map((m) => ({
        id: m.id,
        url: `/api/media/${encodeURIComponent(m.storagePath)}`,
        mimeType: m.mimeType,
        durationS: m.durationS,
        storagePath: m.storagePath,
      })),
      _count: undefined,
    });
  } catch (error) {
    console.error("Journal entry fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch entry" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`journal-update:${user.id}`, 60, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.journalEntry.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const ageMs = Date.now() - new Date(existing.createdAt).getTime();
    const body = await request.json();
    const isTranscriptionOnly = Object.keys(body).length === 1 && body.transcriptionStatus !== undefined;
    if (ageMs > 24 * 60 * 60 * 1000 && !body.forceUnlock && !isTranscriptionOnly) {
      return NextResponse.json(
        { error: "Entry is locked (older than 24 hours)" },
        { status: 403 }
      );
    }
    const validated = journalEntrySchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.content !== undefined) updateData.content = validated.content;
    if (validated.mood !== undefined) updateData.mood = validated.mood;
    if (validated.tags !== undefined) updateData.tags = validated.tags;
    if (validated.isPrivate !== undefined) updateData.isPrivate = validated.isPrivate;
    if (validated.inkData !== undefined) updateData.inkData = validated.inkData;
    if (validated.canvasData !== undefined) updateData.canvasData = validated.canvasData;
    if (validated.templateId !== undefined) updateData.templateId = validated.templateId;
    if (validated.transcriptionStatus !== undefined) updateData.transcriptionStatus = validated.transcriptionStatus;
    if (validated.pageCount !== undefined) updateData.pageCount = validated.pageCount;

    if (validated.contentRich !== undefined) {
      updateData.contentRich = validated.contentRich;
      if (isValidTiptapDoc(validated.contentRich)) {
        updateData.contentPlainText = tiptapDocToPlainText(validated.contentRich);
      }
    } else if (validated.content !== undefined) {
      updateData.contentRich = plainTextToTiptapDoc(validated.content);
      updateData.contentPlainText = validated.content;
    } else if (!isValidTiptapDoc(existing.contentRich) && existing.content) {
      updateData.contentRich = plainTextToTiptapDoc(existing.content);
      updateData.contentPlainText = existing.contentPlainText || existing.content;
    }

    if (validated.contentPlainText !== undefined && !validated.contentRich) {
      updateData.contentPlainText = validated.contentPlainText;
    }

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Journal update error:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}
