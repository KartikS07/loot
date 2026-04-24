import Anthropic from "@anthropic-ai/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const getConvex = () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
};

// Fire-and-forget — never blocks the main research flow
async function logStep(params: {
  sessionId: string;
  agentName: string;
  step: string;
  input?: string;
  output?: string;
  tokensUsed?: number;
  durationMs?: number;
  status: string;
}) {
  try {
    const convex = getConvex();
    if (!convex) return;
    await convex.mutation(api.searches.logAgentStep, params);
  } catch (e) {
    console.warn("[research] Convex log failed (non-fatal):", e);
  }
}

function extractJson(text: string): string {
  // Find the first { and last } to handle any text before/after JSON
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  return text.slice(start, end + 1);
}

const SYSTEM_PROMPT = `You are Loot's AI Researcher — an expert shopping advisor for Indian consumers. Your job is to take a shopping query and return a personalised, trusted top-5 product shortlist.

ALWAYS respond with ONLY a valid JSON object. No text before or after. No markdown fences.

JSON schema:
{
  "phase": "clarify" | "results",
  "clarifyQuestion": string | null,
  "educationLayer": {
    "categoryGuide": string,
    "commonMistakes": string[],
    "insiderTip": string
  } | null,
  "recommendations": [
    {
      "rank": number,
      "name": string,
      "tagline": string,
      "whyForYou": string,
      "expertScore": number,
      "specs": { [key: string]: string },
      "pros": string[],
      "cons": string[],
      "estimatedPrice": string,
      "platformHint": string
    }
  ] | null,
  "summary": string | null
}

Rules:
- If the initial query is vague (missing budget, use-case, or key context), set phase=clarify and ask ONE specific question. Max 1 clarifying round.
- If the query has enough context OR after one round of clarification, set phase=results with top-5 recommendations.
- educationLayer is required when phase=results.
- whyForYou must be personalised to the user's persona and use-case.
- estimatedPrice must be in Indian Rupees (₹) with a realistic current market price.
- platformHint: which Indian platform is likely cheapest (e.g. "Amazon India", "Flipkart", "Croma").
- expertScore: 1-10, weighted by user's stated priorities.
- specs: only specs relevant to the user's use-case (3-5 max).
- pros/cons: mapped to the user's specific scenario, not generic.`;

export async function POST(req: Request) {
  const startTime = Date.now();
  let sessionId = "unknown";

  try {
    const body = await req.json();
    const { messages, userProfile, sessionId: sid } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      userProfile: {
        persona?: string;
        expertiseLevel?: string;
        savedCards?: string[];
        upiPreferences?: string[];
      };
      sessionId: string;
    };
    sessionId = sid;

    const profileContext = `\nUser profile:
- Shopping persona: ${userProfile.persona ?? "not set"}
- Tech expertise: ${userProfile.expertiseLevel ?? "beginner"}
- Bank cards for discount calculation: ${userProfile.savedCards?.join(", ") || "none"}
- UPI apps: ${userProfile.upiPreferences?.join(", ") || "none"}

Personalise all recommendations, pros/cons, and education depth to this profile.`;

    // Log start (non-blocking)
    logStep({ sessionId, agentName: "researcher", step: "start", input: messages.at(-1)?.content, status: "running" });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT + profileContext,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    console.log("[research] Raw response:", rawText.slice(0, 200));

    const jsonStr = extractJson(rawText);
    const parsed = JSON.parse(jsonStr);

    // Log completion (non-blocking)
    logStep({
      sessionId,
      agentName: "researcher",
      step: "complete",
      output: jsonStr.slice(0, 500),
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      durationMs: Date.now() - startTime,
      status: "complete",
    });

    return Response.json(parsed);
  } catch (err) {
    console.error("[research] Error:", err);
    logStep({ sessionId, agentName: "researcher", step: "error", output: String(err), durationMs: Date.now() - startTime, status: "error" });
    return Response.json({ error: "Research failed. Please try again.", phase: "error" }, { status: 500 });
  }
}
