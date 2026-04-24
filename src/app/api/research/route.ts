import Anthropic from "@anthropic-ai/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const SYSTEM_PROMPT = `You are Loot's AI Researcher — an expert shopping advisor for Indian consumers. Your job is to take a shopping query and return a personalized, trusted top-5 product recommendation.

You have access to web_search. Use it to research products before recommending.

ALWAYS respond with valid JSON matching this exact schema:
{
  "phase": "clarify" | "research" | "results",
  "clarifyQuestion": string | null,          // only if phase = clarify
  "educationLayer": {                         // only if phase = results
    "categoryGuide": string,
    "commonMistakes": string[],
    "insiderTip": string
  } | null,
  "recommendations": [                        // only if phase = results
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
      "platformHint": string,
      "imageQuery": string
    }
  ] | null,
  "summary": string | null
}

Rules:
- If the query is vague, ask ONE clarifying question (phase: clarify). Max 2 clarifying rounds.
- After clarifications, phase = results. Search the web, then return top-5 recommendations.
- educationLayer must always be present in results phase.
- whyForYou must be personalised to the user's stated persona and use case.
- estimatedPrice must be in Indian Rupees (₹).
- specs must only include specs relevant to the user's use case.
- platformHint should say which platform is likely cheapest (Amazon/Flipkart/Croma etc).
- imageQuery is a short search query to find a product image (used for display).
- NEVER recommend products you cannot verify exist. Use web_search.
- Do not add any text outside the JSON object.`;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, userProfile, sessionId } = body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    userProfile: {
      persona?: string;
      expertiseLevel?: string;
      savedCards?: string[];
      upiPreferences?: string[];
    };
    sessionId: string;
  };

  const profileContext = `
User profile:
- Persona: ${userProfile.persona ?? "not set"}
- Expertise: ${userProfile.expertiseLevel ?? "beginner"}
- Bank cards: ${userProfile.savedCards?.join(", ") || "none saved"}
- UPI: ${userProfile.upiPreferences?.join(", ") || "none saved"}

Tailor all recommendations to this profile. Weigh pros/cons based on their persona. Calibrate education depth to their expertise level.`;

  const startTime = Date.now();

  // Log agent start
  await convex.mutation(api.searches.logAgentStep, {
    sessionId,
    agentName: "researcher",
    step: "start",
    input: messages[messages.length - 1]?.content ?? "",
    status: "running",
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT + "\n\n" + profileContext,
      tools: [
        {
          type: "web_search_20250305" as Anthropic.Tool["type"],
          name: "web_search",
        } as Anthropic.Tool,
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // Extract text content
    let resultText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        resultText = block.text;
        break;
      }
    }

    // Log completion
    await convex.mutation(api.searches.logAgentStep, {
      sessionId,
      agentName: "researcher",
      step: "complete",
      output: resultText.slice(0, 500),
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      durationMs: Date.now() - startTime,
      status: "complete",
    });

    // Parse and validate JSON
    const parsed = JSON.parse(resultText);
    return Response.json(parsed);
  } catch (err) {
    await convex.mutation(api.searches.logAgentStep, {
      sessionId,
      agentName: "researcher",
      step: "error",
      output: String(err),
      durationMs: Date.now() - startTime,
      status: "error",
    });

    return Response.json(
      { error: "Research failed. Please try again.", phase: "error" },
      { status: 500 }
    );
  }
}
