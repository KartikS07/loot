import { GoogleGenerativeAI } from "@google/generative-ai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const MODEL = "gemini-2.5-flash";

const getConvex = () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
};

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
    console.warn("[research] Convex log skipped:", String(e).slice(0, 100));
  }
}

// Shared sanitiser — converts {} → null recursively (Gemini sometimes returns empty objects for optional fields)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitize(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj !== null && typeof obj === "object") {
    if (Object.keys(obj).length === 0) return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitize(v);
    return out;
  }
  return obj;
}

const SYSTEM_PROMPT = `You are Loot's AI Researcher — a sharp, opinionated shopping advisor for Indian consumers. Your job: take a shopping query and return a personalised top-5 shortlist that saves the user hours of research.

You MUST respond with ONLY a valid JSON object. No markdown. No explanation. No text outside the JSON.

JSON schema (follow exactly):
{
  "phase": "clarify" | "results",
  "clarifyQuestion": "string or null — only when phase is clarify",
  "educationLayer": {
    "categoryGuide": "2-3 sentence plain-English guide to the most important specs for this category",
    "commonMistakes": ["mistake 1", "mistake 2", "mistake 3"],
    "insiderTip": "one contrarian or non-obvious tip that separates smart buyers from the rest"
  },
  "recommendations": [
    {
      "rank": 1,
      "name": "Full product name with model number",
      "tagline": "10-word punchy description",
      "whyForYou": "One sentence — why THIS product for THIS user's exact use case and persona",
      "expertScore": 8.5,
      "specs": {
        "key spec 1": "value",
        "key spec 2": "value"
      },
      "pros": ["pro 1", "pro 2", "pro 3"],
      "cons": ["con 1", "con 2"],
      "platformHint": "Usually found on: Amazon India / Flipkart / Croma"
    }
  ],
  "summary": "One sentence wrap-up of the top recommendation and why"
}

Rules:
- If the query is missing BOTH budget AND primary use-case, set phase=clarify with ONE specific question. Otherwise, go straight to phase=results.
- phase=results: always include educationLayer + exactly 5 recommendations.
- educationLayer is required in results phase even if phase is clarify (set to null if clarify).
- whyForYou: personalised to the user's persona (value_hunter / quality_seeker / brand_loyalist) and stated use-case.
- expertScore: 1-10, weighted by what the user said matters to them. Not a generic score.
- specs: only 3-5 specs that matter for this user's use-case. Skip irrelevant ones.
- platformHint: which Indian platform typically stocks this product. Do NOT include any price in platformHint.
- recommendations ranked by fit for this specific user — not by price or popularity alone.`;

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

    const profileContext = `\nUser profile for personalisation:
- Shopping persona: ${userProfile.persona ?? "not set"} (value_hunter = best deal, quality_seeker = best product, brand_loyalist = trusted brands)
- Tech expertise level: ${userProfile.expertiseLevel ?? "beginner"} (calibrate explanation depth accordingly)
- Bank cards (for discount hints): ${userProfile.savedCards?.join(", ") || "none specified"}
- UPI apps: ${userProfile.upiPreferences?.join(", ") || "none specified"}

Weight recommendations, pros/cons, and education depth to this profile.`;

    // Fire-and-forget log
    logStep({ sessionId, agentName: "researcher", step: "start", input: messages.at(-1)?.content, status: "running" });

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_PROMPT + profileContext,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        temperature: 0.3,
      },
    });

    // Build chat history — Gemini uses "model" not "assistant"
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages.at(-1)!.content;
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage);
    const text = result.response.text();

    console.log("[research] Gemini response preview:", text.slice(0, 150));

    const parsed = sanitize(JSON.parse(text));

    logStep({
      sessionId,
      agentName: "researcher",
      step: "complete",
      output: text.slice(0, 500),
      tokensUsed: result.response.usageMetadata?.totalTokenCount,
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
