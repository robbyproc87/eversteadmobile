import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser, getProfile } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { SAGE_SYSTEM_PROMPT } from "@/lib/coach/sage-prompt";
import { COACH_PROMPTS } from "@/lib/coach/specialist-prompts";
import { assembleCoachContext } from "@/lib/coach/context-assembler";
import { COACH_TOOLS, getNavigationUrl } from "@/lib/coach/coach-tools";
import { executeTool } from "@/lib/coach/tool-executor";
import type { CoachAction } from "@/lib/coach/coach-types";
import { canAccess } from "@/lib/plan/access";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const GREETING_TRIGGER = "__SAGE_GREETING__";
const MAX_TOOL_ITERATIONS = 3;

function getSystemPrompt(coachType: string): string {
  if (coachType === "sage" || !coachType) return SAGE_SYSTEM_PROMPT;
  return COACH_PROMPTS[coachType] || SAGE_SYSTEM_PROMPT;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const allowed = await canAccess(user.id, "ai_coaching");
  if (!allowed) {
    return new Response(JSON.stringify({ error: "upgrade_required" }), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { conversationId: existingConvId, message, currentPage, coachType: requestedCoachType } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isGreetingTrigger = message.trim() === GREETING_TRIGGER;

    const profile = await getProfile(user.id);
    const userName = profile?.name || "there";
    const memberSince = profile?.created_at
      ? new Date(profile.created_at).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : "recently";

    let conversationId = existingConvId;
    let coachType = requestedCoachType || "sage";

    if (!conversationId) {
      const newConversation = await prisma.coachConversation.create({
        data: { userId: user.id, coachType },
      });
      conversationId = newConversation.id;
    } else {
      const conv = await prisma.coachConversation.findFirst({
        where: { id: conversationId, userId: user.id },
      });
      if (!conv) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      coachType = conv.coachType || "sage";
    }

    if (!isGreetingTrigger) {
      await prisma.coachMessage.create({
        data: {
          conversationId,
          role: "user",
          content: message.trim(),
        },
      });
    }

    const { contextString } = await assembleCoachContext(
      user.id,
      userName,
      memberSince,
      currentPage
    );

    let formattedMessages: Anthropic.MessageParam[];

    if (isGreetingTrigger) {
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
      formattedMessages = [
        {
          role: "user",
          content: `The user just opened a new conversation with you. It's ${timeOfDay}. Based on their context (time of day, recent activity, current goals), give them a warm, personalized greeting in your unique voice and style. Reference something specific from their data — their recent journal mood, a goal they set, their reading list, their streak status — to show you're paying attention. Keep it to 2-3 sentences max. End with a gentle question that invites them to share. Do NOT start with "Hey, what's on your mind?" — make it feel like you've been keeping an eye on their journey.`,
        },
      ];
    } else {
      const history = await prisma.coachMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { role: true, content: true },
      });

      formattedMessages = history.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    }

    const systemPrompt = getSystemPrompt(coachType) + "\n\n" + contextString;

    const encoder = new TextEncoder();
    const sseHeaders = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    };

    const readable = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ conversationId })}\n\n`)
          );

          let currentMessages: Anthropic.MessageParam[] = [...formattedMessages];
          const allActions: CoachAction[] = [];
          let finalText = "";
          let iterations = 0;

          while (iterations < MAX_TOOL_ITERATIONS) {
            iterations++;

            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1024,
              system: systemPrompt,
              messages: currentMessages,
              tools: COACH_TOOLS as any,
            });

            const toolUseBlocks = response.content.filter(
              (block): block is Anthropic.ContentBlock & { type: "tool_use"; id: string; name: string; input: any } =>
                block.type === "tool_use"
            );
            const textBlocks = response.content.filter(
              (block): block is Anthropic.TextBlock => block.type === "text"
            );

            if (toolUseBlocks.length === 0) {
              finalText = textBlocks.map((b) => b.text).join("");
              break;
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ thinking: true })}\n\n`)
            );

            const toolResults = await Promise.all(
              toolUseBlocks.map(async (toolUse) => {
                const result = await executeTool(toolUse.name, toolUse.input, user.id);

                const action: CoachAction = {
                  tool: toolUse.name,
                  success: result.success,
                  message: result.message,
                  navigateTo: getNavigationUrl(toolUse.name),
                  invalidateKeys: result.invalidateKeys,
                };
                allActions.push(action);

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ action })}\n\n`)
                );

                return {
                  type: "tool_result" as const,
                  tool_use_id: toolUse.id,
                  content: JSON.stringify(result),
                };
              })
            );

            if (textBlocks.length > 0) {
              const partialText = textBlocks.map((b) => b.text).join("");
              if (partialText.trim()) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: partialText })}\n\n`)
                );
              }
            }

            currentMessages = [
              ...currentMessages,
              { role: "assistant" as const, content: response.content as any },
              { role: "user" as const, content: toolResults as any },
            ];
          }

          if (finalText) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: finalText })}\n\n`)
            );
          }

          await prisma.coachMessage.create({
            data: {
              conversationId,
              role: "assistant",
              content: finalText,
              contextSummary: contextString.slice(0, 500),
              actions: allActions.length > 0 ? (allActions as any) : undefined,
            },
          });

          if (!isGreetingTrigger) {
            const history = await prisma.coachMessage.findMany({
              where: { conversationId },
              orderBy: { createdAt: "asc" },
              take: 2,
              select: { id: true },
            });
            const isFirstExchange = history.length <= 2;
            if (isFirstExchange && finalText.length > 0) {
              const titleSnippet =
                message.trim().slice(0, 60) +
                (message.trim().length > 60 ? "..." : "");
              await prisma.coachConversation.update({
                where: { id: conversationId },
                data: { title: titleSnippet },
              });
            }
          } else {
            await prisma.coachConversation.update({
              where: { id: conversationId },
              data: { title: "New conversation" },
            });
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );
          controller.close();
        } catch (err) {
          console.error("Streaming error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, { headers: sseHeaders });
  } catch (error) {
    console.error("Coach chat error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
