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
      "name": "Clean product name: brand + official model identifier ONLY. No padding (e.g. NOT 'Sony WH-1000XM6 Wireless Headphones Microphones Studio Quality' — just 'Sony WH-1000XM6'). Used for downstream search.",
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
- If the query is missing ANY of (budget, primary use-case, brand/feature preference) — set phase=clarify with ONE focused question targeting the most important missing dimension. Pick the dimension that would change the recommendations most. Only proceed to phase=results when all three are present, OR the user replied "no preference" / "any" / "skip" / similar in a previous turn.
- HARD LIMIT: clarify at most ONCE per conversation. If you have already asked a clarify question (the messages array contains an assistant turn with phase=clarify), you MUST set phase=results on the next user reply, even if some dimensions are still missing. Use sensible defaults for missing dimensions and call them out in the educationLayer. Never re-ask.
- phase=results: always include educationLayer + exactly 5 recommendations.
- educationLayer is required in results phase even if phase is clarify (set to null if clarify).
- whyForYou: personalised to the user's persona (value_hunter / quality_seeker / brand_loyalist) and stated use-case.
- expertScore: 1-10, weighted by what the user said matters to them. Not a generic score.
- specs: only 3-5 specs that matter for this user's use-case. Skip irrelevant ones.
- platformHint: which Indian platform typically stocks this product. Do NOT include any price in platformHint.
- recommendations ranked by fit for this specific user — not by price or popularity alone.`;

const DEEP_SYSTEM_PROMPT = `You are Loot's AI Researcher in DEEP MODE — a premium, long-form shopping advisor for Indian consumers who paid to get the best possible research. Your job: take a shopping query and return an exhaustive top-10 shortlist plus insider knowledge that normally takes hours to accumulate.

You MUST respond with ONLY a valid JSON object. No markdown. No explanation. No text outside the JSON.

JSON schema (follow exactly):
{
  "phase": "clarify" | "results",
  "clarifyQuestion": "string or null — only when phase is clarify",
  "educationLayer": {
    "categoryGuide": "4-5 sentence plain-English deep-dive buying guide for this category. Cover: what specs actually matter, how to read the marketing jargon, the single most expensive mistake people make, and the sweet-spot price tier for most buyers.",
    "commonMistakes": ["mistake 1", "mistake 2", "mistake 3"],
    "insiderTip": "one contrarian or non-obvious tip that separates smart buyers from the rest"
  },
  "recommendations": [
    {
      "rank": 1,
      "name": "Clean product name: brand + official model identifier ONLY. No padding (e.g. NOT 'Sony WH-1000XM6 Wireless Headphones Microphones Studio Quality' — just 'Sony WH-1000XM6'). Used for downstream search.",
      "tagline": "10-word punchy description",
      "whyForYou": "One sentence — why THIS product for THIS user's exact use case and persona",
      "expertScore": 8.5,
      "specs": { "key spec 1": "value", "key spec 2": "value" },
      "pros": ["pro 1", "pro 2", "pro 3"],
      "cons": ["con 1", "con 2"],
      "platformHint": "Usually found on: Amazon India / Flipkart / Croma"
    }
  ],
  "proTips": [
    "3-5 insider tips specific to buying this category in India — timing, bundled accessories to avoid, warranty gotchas, seller traps"
  ],
  "whatReviewsDontTellYou": [
    "3-5 non-obvious truths about this category — long-term ownership pains, failure modes, accessories you'll actually need, resale value patterns"
  ],
  "summary": "One sentence wrap-up of the top recommendation and why"
}

Rules:
- If the query is missing ANY of (budget, primary use-case, brand/feature preference) — set phase=clarify with ONE focused question targeting the most important missing dimension. Pick the dimension that would change the recommendations most. Only proceed to phase=results when all three are present, OR the user replied "no preference" / "any" / "skip" / similar in a previous turn.
- HARD LIMIT: clarify at most ONCE per conversation. If you have already asked a clarify question (the messages array contains an assistant turn with phase=clarify), you MUST set phase=results on the next user reply, even if some dimensions are still missing. Use sensible defaults for missing dimensions and call them out in the educationLayer. Never re-ask.
- phase=results: always include educationLayer + exactly 10 recommendations + proTips (3-5 items) + whatReviewsDontTellYou (3-5 items).
- phase=clarify: you may omit proTips, whatReviewsDontTellYou, and recommendations.
- proTips: insider-level, India-specific, actionable. Not generic advice. Think "what a friend who works in this industry would tell you."
- whatReviewsDontTellYou: uncomfortable truths — things that don't show up in a 4.3-star review because they only matter after 6 months of ownership.
- whyForYou: personalised to the user's persona (value_hunter / quality_seeker / brand_loyalist) and stated use-case.
- expertScore: 1-10, weighted by what the user said matters to them.
- specs: 4-6 specs that matter — deep mode can surface one or two more than standard.
- platformHint: Indian platform. No price in platformHint.`;

export async function POST(req: Request) {
  const startTime = Date.now();
  let sessionId = "unknown";

  try {
    const body = await req.json();
    const { messages, userProfile, sessionId: sid, deep, email } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      userProfile: {
        persona?: string;
        expertiseLevel?: string;
        savedCards?: string[];
        upiPreferences?: string[];
      };
      sessionId: string;
      deep?: boolean;
      email?: string;
    };
    sessionId = sid;

    // Server-side premium re-check. Silent downgrade if not verified — never reject.
    let deepVerified = false;
    if (deep === true && email) {
      try {
        const convex = getConvex();
        if (convex) {
          const status = await convex.query(api.users.getPremiumStatus, { email });
          deepVerified = Boolean(status?.isPremium);
        }
      } catch (e) {
        console.warn("[research] Premium check failed, falling back to standard:", String(e).slice(0, 100));
      }
    }

    const profileContext = `\nUser profile for personalisation:
- Shopping persona: ${userProfile.persona ?? "not set"} (value_hunter = best deal, quality_seeker = best product, brand_loyalist = trusted brands)
- Tech expertise level: ${userProfile.expertiseLevel ?? "beginner"} (calibrate explanation depth accordingly)
- Bank cards (for discount hints): ${userProfile.savedCards?.join(", ") || "none specified"}
- UPI apps: ${userProfile.upiPreferences?.join(", ") || "none specified"}

Weight recommendations, pros/cons, and education depth to this profile.`;

    // Fire-and-forget log
    logStep({
      sessionId,
      agentName: "researcher",
      step: deepVerified ? "start:deep" : "start",
      input: messages.at(-1)?.content,
      status: "running",
    });

    const activePrompt = deepVerified ? DEEP_SYSTEM_PROMPT : SYSTEM_PROMPT;

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: activePrompt + profileContext,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: deepVerified ? 16384 : 8192,
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
