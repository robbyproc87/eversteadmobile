import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { journalEntrySchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limiter";
import { plainTextToTiptapDoc, tiptapDocToPlainText, isValidTiptapDoc } from "@/lib/journal/tiptap-utils";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200") || 200, 500);

  try {
    const where: Record<string, unknown> = { userId: user.id };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { contentPlainText: { contains: q, mode: "insensitive" } },
        { tags: { has: q } },
      ];
    }

    const entries = await prisma.journalEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        media: {
          select: { id: true, storagePath: true, mimeType: true, durationS: true },
          orderBy: { createdAt: "asc" },
          take: 3,
        },
        _count: { select: { media: true } },
      },
    });

    const legacyEntries = entries.filter((e) => e.inkData && !e.canvasData);
    if (legacyEntries.length > 0) {
      Promise.all(
        legacyEntries.map((e) =>
          prisma.journalEntry.update({
            where: { id: e.id },
            data: { canvasData: [e.inkData as object[]], pageCount: 1 },
          }).catch(() => {})
        )
      ).catch(() => {});
    }

    const withMedia = entries.map((e) => {
      const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
      const contentRich = isValidTiptapDoc(e.contentRich)
        ? e.contentRich
        : e.content
          ? plainTextToTiptapDoc(e.content)
          : EMPTY_DOC;

      const derivedPlainText =
        e.contentPlainText ||
        e.content ||
        (isValidTiptapDoc(e.contentRich) ? tiptapDocToPlainText(e.contentRich) : "") ||
        "";

      return {
        ...e,
        contentRich,
        contentPlainText: derivedPlainText,
        hasMedia: e._count.media > 0,
        mediaCount: e._count.media,
        media: e.media.map((m) => ({
          id: m.id,
          url: `/api/media/${encodeURIComponent(m.storagePath)}`,
          mimeType: m.mimeType,
          durationS: m.durationS,
          storagePath: m.storagePath,
        })),
        _count: undefined,
      };
    });

    return NextResponse.json(withMedia);
  } catch (error) {
    console.error("Journal fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`journal:${user.id}`, 30, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const validated = journalEntrySchema.parse(body);

    let contentRich = validated.contentRich ?? undefined;
    let contentPlainText = validated.contentPlainText ?? undefined;

    if (!contentRich && validated.content) {
      contentRich = plainTextToTiptapDoc(validated.content);
    }
    if (!contentPlainText && contentRich && isValidTiptapDoc(contentRich)) {
      contentPlainText = tiptapDocToPlainText(contentRich);
    }
    if (!contentPlainText && validated.content) {
      contentPlainText = validated.content;
    }

    const entry = await prisma.journalEntry.create({
      data: {
        userId: user.id,
        title: validated.title,
        content: validated.content,
        contentRich: contentRich ?? undefined,
        contentPlainText: contentPlainText ?? undefined,
        inkData: validated.inkData,
        canvasData: validated.canvasData ?? undefined,
        mood: validated.mood,
        tags: validated.tags || [],
        isPrivate: validated.isPrivate ?? false,
        templateId: validated.templateId ?? undefined,
        transcriptionStatus: validated.transcriptionStatus ?? undefined,
        pageCount: validated.pageCount ?? 1,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Journal create error:", error);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}
