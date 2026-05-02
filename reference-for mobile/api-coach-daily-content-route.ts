import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser, getProfile } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { assembleCoachContext } from "@/lib/coach/context-assembler";
import { canAccess } from "@/lib/plan/access";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const allowed = await canAccess(user.id, "ai_coaching");
  if (!allowed) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 402 });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const existing = await prisma.dailyContent.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
    });

    if (existing && existing.quote && existing.song && existing.greeting && existing.healthset) {
      return NextResponse.json({
        quote: JSON.parse(existing.quote),
        song: JSON.parse(existing.song),
        greeting: existing.greeting,
        healthset: existing.healthset,
        cached: true,
      });
    }

    const profile = await getProfile(user.id);
    const userName = profile?.name || "there";
    const memberSince = profile?.created_at
      ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "recently";

    const { contextString } = await assembleCoachContext(user.id, userName, memberSince, "Today");

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

    const prompt = `Based on the user's context below, generate personalized daily content. Today is ${dayOfWeek}, it's ${timeOfDay}.

${contextString}

Generate the following as a JSON object (no markdown, just raw JSON):
{
  "quote": {
    "text": "A motivational quote that feels personally relevant to this user's current journey, goals, or recent activity. Make it feel chosen specifically for them.",
    "author": "Attribution (can be a famous person, a proverb, or 'Sage')"
  },
  "song": {
    "title": "A real song that matches the user's likely mood or energy level today",
    "artist": "The actual artist",
    "reason": "A brief 1-sentence explanation of why this song fits their day"
  },
  "greeting": "A short, warm ${timeOfDay} greeting for ${userName}. MAX 10 WORDS. Example: 'Happy Thursday — let\\'s build on your momentum.' Keep it brief and punchy, like a friendly one-liner. No full sentences or motivational paragraphs.",
  "healthset": "A specific health/wellness prompt for today based on their activity patterns. Something actionable they can do today. 1-2 sentences."
}

Important: Return ONLY the JSON object, no code fences, no explanation.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from AI");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(textContent.text.trim());
    } catch {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    await prisma.dailyContent.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: today,
        },
      },
      create: {
        userId: user.id,
        date: today,
        quote: JSON.stringify(parsed.quote),
        song: JSON.stringify(parsed.song),
        greeting: parsed.greeting,
        healthset: parsed.healthset,
      },
      update: {
        quote: JSON.stringify(parsed.quote),
        song: JSON.stringify(parsed.song),
        greeting: parsed.greeting,
        healthset: parsed.healthset,
      },
    });

    return NextResponse.json({
      quote: parsed.quote,
      song: parsed.song,
      greeting: parsed.greeting,
      healthset: parsed.healthset,
      cached: false,
    });
  } catch (error) {
    console.error("Daily content error:", error);
    return NextResponse.json(
      { error: "Failed to generate daily content" },
      { status: 500 }
    );
  }
}
