import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { deleteStorageObject } from "@/lib/storage/journalMedia";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: entryId, mediaId } = await params;

  try {
    const media = await prisma.journalMedia.findFirst({
      where: { id: mediaId, entryId, userId: user.id },
    });

    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    await deleteStorageObject(media.storagePath);

    await prisma.journalMedia.delete({
      where: { id: mediaId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Media delete error:", error);
    return NextResponse.json({ error: "Failed to delete media" }, { status: 500 });
  }
}
