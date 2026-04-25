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
    console.warn("[deep-dive] Convex log skipped:", String(e).slice(0, 100));
  }
}

const SYSTEM_PROMPT = `You are Loot's Expert Deep Dive — a senior product reviewer writing for an Indian consumer who already shortlisted this product and now wants the honest, opinionated breakdown a friend-who-works-in-the-industry would give.

You MUST respond with ONLY a valid JSON object. No markdown. No explanation. No text outside the JSON.

JSON schema (follow EXACTLY — all five keys required):
{
  "specAnalysis": "3-5 sentence deep breakdown of the specs and what they mean for real-world use. Translate numbers into felt experience. Call out where specs look good on paper but disappoint in daily use, and vice versa.",
  "failureModes": ["common failure 1 — short, specific", "common failure 2", "common failure 3"],
  "maintenanceCost": "One line. Format like 'Low — around ₹200/year' or 'Medium — ₹2000/year, mostly cleaning and replaceable parts'. Include the INR number.",
  "whatToAvoid": ["pitfall 1 — e.g. a variant to skip, a setting to disable, a listing trap", "pitfall 2", "pitfall 3"],
  "bestUseCase": "Single sentence describing the ideal user for this product PLUS one honest caveat. Form: 'Best for X who want Y — but skip it if Z.'"
}

Rules:
- specAnalysis: 3-5 sentences, no fluff, name actual specs from the context.
- failureModes: exactly 3, based on common real-world complaints / known weak spots for this class of product.
- maintenanceCost: always include a ₹ estimate. Err toward realistic, not optimistic.
- whatToAvoid: exactly 3 pitfalls, actionable and specific to Indian retail conditions where relevant.
- bestUseCase: one sentence, honest, includes a "but" or "skip if".
- No emoji. No hedging. Sharp, useful, plain English.`;

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

type ProductContext = {
  specs?: Record<string, string>;
  pros?: string[];
  cons?: string[];
  tagline?: string;
};

function buildUserPrompt(productName: string, ctx: ProductContext): string {
  const specLines = ctx.specs
    ? Object.entries(ctx.specs)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")
    : "(none provided)";
  const pros = ctx.pros?.length ? ctx.pros.map((p) => `- ${p}`).join("\n") : "(none provided)";
  const cons = ctx.cons?.length ? ctx.cons.map((c) => `- ${c}`).join("\n") : "(none provided)";

  return `Product: ${productName}
Tagline: ${ctx.tagline ?? "(none)"}

Known specs:
${specLines}

Known pros:
${pros}

Known cons:
${cons}

Produce the Expert Deep Dive JSON now.`;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const sessionId = `deepdive_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = await req.json().catch(() => null);

    if (!isObject(body)) {
      return Response.json({ error: "Invalid body" }, { status: 400 });
    }

    const { email, productName, productContext } = body as {
      email?: unknown;
      productName?: unknown;
      productContext?: unknown;
    };

    if (typeof email !== "string" || !email.trim()) {
      return Response.json({ error: "email required" }, { status: 400 });
    }
    if (typeof productName !== "string" || !productName.trim()) {
      return Response.json({ error: "productName required" }, { status: 400 });
    }
    if (!isObject(productContext)) {
      return Response.json({ error: "productContext must be an object" }, { status: 400 });
    }

    // Server-side premium gate — NON-NEGOTIABLE.
    const convex = getConvex();
    if (!convex) {
      console.error("[deep-dive] Convex URL missing — cannot verify premium");
      return Response.json({ error: "Deep dive failed" }, { status: 500 });
    }

    let isPremium = false;
    try {
      const status = await convex.query(api.users.getPremiumStatus, { email });
      isPremium = Boolean(status?.isPremium);
    } catch (e) {
      console.error("[deep-dive] Premium check failed:", String(e).slice(0, 200));
      return Response.json({ error: "Deep dive failed" }, { status: 500 });
    }

    if (!isPremium) {
      return Response.json({ error: "premium required" }, { status: 403 });
    }

    // Normalise context to a safe shape before sending to the model.
    const ctx = productContext as ProductContext;
    const safeCtx: ProductContext = {
      specs: isObject(ctx.specs)
        ? Object.fromEntries(
            Object.entries(ctx.specs)
              .filter(([, v]) => typeof v === "string")
              .map(([k, v]) => [String(k), String(v)])
          )
        : undefined,
      pros: Array.isArray(ctx.pros) ? ctx.pros.filter((p): p is string => typeof p === "string") : undefined,
      cons: Array.isArray(ctx.cons) ? ctx.cons.filter((c): c is string => typeof c === "string") : undefined,
      tagline: typeof ctx.tagline === "string" ? ctx.tagline : undefined,
    };

    logStep({
      sessionId,
      agentName: "deep-dive",
      step: "start",
      input: productName.slice(0, 200),
      status: "running",
    });

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
        temperature: 0.3,
      },
    });

    const userPrompt = buildUserPrompt(productName, safeCtx);
    const result = await model.generateContent(userPrompt);
    const text = result.response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("[deep-dive] JSON parse failed:", String(e).slice(0, 200), "raw:", text.slice(0, 200));
      logStep({
        sessionId,
        agentName: "deep-dive",
        step: "parse-error",
        output: text.slice(0, 300),
        durationMs: Date.now() - startTime,
        status: "error",
      });
      return Response.json({ error: "Deep dive failed" }, { status: 500 });
    }

    // Validate shape minimally — all 5 keys must exist and be the right primitive type.
    if (
      !isObject(parsed) ||
      typeof parsed.specAnalysis !== "string" ||
      !Array.isArray(parsed.failureModes) ||
      typeof parsed.maintenanceCost !== "string" ||
      !Array.isArray(parsed.whatToAvoid) ||
      typeof parsed.bestUseCase !== "string"
    ) {
      console.error("[deep-dive] Invalid shape from model:", JSON.stringify(parsed).slice(0, 300));
      logStep({
        sessionId,
        agentName: "deep-dive",
        step: "shape-error",
        output: JSON.stringify(parsed).slice(0, 300),
        durationMs: Date.now() - startTime,
        status: "error",
      });
      return Response.json({ error: "Deep dive failed" }, { status: 500 });
    }

    // Normalize arrays to exactly 3 items (spec requires exactly 3 failureModes and 3 whatToAvoid).
    // Gemini occasionally returns 2 or 5 — pad with empty or slice to keep UI predictable.
    const padTo3 = (arr: unknown[]): string[] => {
      const strings = arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      const sliced = strings.slice(0, 3);
      while (sliced.length < 3) sliced.push("—");
      return sliced;
    };

    const clean = {
      specAnalysis: parsed.specAnalysis,
      failureModes: padTo3(parsed.failureModes as unknown[]),
      maintenanceCost: parsed.maintenanceCost,
      whatToAvoid: padTo3(parsed.whatToAvoid as unknown[]),
      bestUseCase: parsed.bestUseCase,
    };

    logStep({
      sessionId,
      agentName: "deep-dive",
      step: "complete",
      output: clean.bestUseCase.slice(0, 200),
      tokensUsed: result.response.usageMetadata?.totalTokenCount,
      durationMs: Date.now() - startTime,
      status: "complete",
    });

    return Response.json(clean);
  } catch (err) {
    console.error("[deep-dive] Error:", err);
    logStep({
      sessionId,
      agentName: "deep-dive",
      step: "error",
      output: String(err).slice(0, 300),
      durationMs: Date.now() - startTime,
      status: "error",
    });
    return Response.json({ error: "Deep dive failed" }, { status: 500 });
  }
}
