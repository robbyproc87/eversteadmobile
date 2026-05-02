import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";
import { mediaConfirmSchema } from "@/lib/validations";
import { JOURNAL_MEDIA } from "@/lib/constants";
import {
  buildPath,
  extFromMime,
  createSignedUploadUrl,
  getSignedUrl,
} from "@/lib/storage/journalMedia";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: entryId } = await params;

  try {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, userId: user.id },
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const mediaItems = await prisma.journalMedia.findMany({
      where: { entryId, userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    const withUrls = await Promise.all(
      mediaItems.map(async (m) => ({
        ...m,
        url: `/api/media/${encodeURIComponent(m.storagePath)}`,
      }))
    );

    return NextResponse.json(withUrls);
  } catch (error) {
    console.error("Media list error:", error);
    return NextResponse.json({ error: "Failed to list media" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimitResult = checkRateLimit(`media-upload:${user.id}`, 30, 60000);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  const { id: entryId } = await params;

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    const entry = await prisma.journalEntry.findFirst({
      where: { id: entryId, userId: user.id },
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (action === "upload") {
      const body = await request.json();
      const mime = body.mime as string;
      if (!(JOURNAL_MEDIA.ACCEPTED_TYPES as readonly string[]).includes(mime)) {
        return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
      }

      const existingCount = await prisma.journalMedia.count({
        where: { entryId, userId: user.id },
      });
      if (existingCount >= JOURNAL_MEDIA.MAX_ITEMS_PER_ENTRY) {
        return NextResponse.json(
          { error: `Max ${JOURNAL_MEDIA.MAX_ITEMS_PER_ENTRY} items per entry` },
          { status: 400 }
        );
      }

      const ext = extFromMime(mime);
      const path = buildPath(user.id, entryId, ext);

      const uploadData = await createSignedUploadUrl(path);
      if (!uploadData) {
        return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
      }

      return NextResponse.json({
        path,
        signedUrl: uploadData.signedUrl,
        token: uploadData.token,
      });
    }

    if (action === "confirm") {
      const body = await request.json();
      const validated = mediaConfirmSchema.parse(body);

      const expectedPrefix = `${user.id}/${entryId}/`;
      if (!validated.path.startsWith(expectedPrefix)) {
        return NextResponse.json({ error: "Invalid path" }, { status: 403 });
      }

      const media = await prisma.journalMedia.create({
        data: {
          userId: user.id,
          entryId,
          mimeType: validated.mime,
          storagePath: validated.path,
          width: validated.width,
          height: validated.height,
          bytes: validated.bytes,
          durationS: validated.durationS,
        },
      });

      return NextResponse.json({
        ...media,
        url: `/api/media/${encodeURIComponent(media.storagePath)}`,
      }, { status: 201 });
    }

    return NextResponse.json({ error: "Missing action param (upload or confirm)" }, { status: 400 });
  } catch (error) {
    console.error("Media upload error:", error);
    return NextResponse.json({ error: "Failed to process media" }, { status: 500 });
  }
}
