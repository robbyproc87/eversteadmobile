import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10), 50);

  try {
    const mediaItems = await prisma.journalMedia.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        entry: {
          select: {
            id: true,
            content: true,
            mood: true,
            createdAt: true,
          },
        },
      },
    });

    const hasMore = mediaItems.length > limit;
    const items = hasMore ? mediaItems.slice(0, limit) : mediaItems;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const withUrls = items.map((m) => ({
      ...m,
      url: `/api/media/${encodeURIComponent(m.storagePath)}`,
    }));

    return NextResponse.json({
      items: withUrls,
      nextCursor,
    });
  } catch (error) {
    console.error("All media fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
  }
}
