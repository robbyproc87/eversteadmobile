import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { prisma } from "@/lib/prisma";

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
    const meditation = await prisma.generatedMeditation.findFirst({
      where: { id, userId: user.id },
    });

    if (!meditation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const supabase = getServiceClient();
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("meditations")
      .createSignedUrl(meditation.audioPath, 3600);

    if (signedUrlError) {
      console.error("Signed URL error:", signedUrlError);
      return NextResponse.json(
        { ...meditation, audioUrl: null },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ...meditation,
      audioUrl: signedUrlData.signedUrl,
    });
  } catch (error) {
    console.error("Fetch generated meditation error:", error);
    return NextResponse.json(
      { error: "Failed to fetch meditation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const meditation = await prisma.generatedMeditation.findFirst({
      where: { id, userId: user.id },
    });

    if (!meditation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const supabase = getServiceClient();
    await supabase.storage.from("meditations").remove([meditation.audioPath]);

    await prisma.generatedMeditation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete generated meditation error:", error);
    return NextResponse.json(
      { error: "Failed to delete meditation" },
      { status: 500 }
    );
  }
}
