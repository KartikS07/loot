import Razorpay from "razorpay";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const PREMIUM_AMOUNT_PAISE = 19900;                      // ₹199
const VALID_TIP_AMOUNTS_PAISE = new Set([4900, 9900, 19900]); // ₹49 / ₹99 / ₹199
const MIN_AMOUNT_PAISE = 100;
const MAX_EMAIL_CHARS = 320;
const MAX_NOTES_CHARS = 500;
const GENERIC_ERROR = "Order creation failed";

const getRazorpay = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Razorpay keys missing in env");
  }
  return new Razorpay({ key_id, key_secret });
};

const getConvex = () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, kind, amount, notes, profile } = body as {
      email?: unknown;
      kind?: unknown;
      amount?: unknown;
      notes?: unknown;
      profile?: unknown;
    };

    if (typeof email !== "string" || !email || email.length > MAX_EMAIL_CHARS) {
      return Response.json({ error: GENERIC_ERROR }, { status: 400 });
    }
    if (kind !== "tip" && kind !== "premium") {
      return Response.json({ error: GENERIC_ERROR }, { status: 400 });
    }
    if (notes !== undefined && (typeof notes !== "string" || notes.length > MAX_NOTES_CHARS)) {
      return Response.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    let amountPaise: number;
    if (kind === "premium") {
      amountPaise = PREMIUM_AMOUNT_PAISE;
    } else {
      if (
        typeof amount !== "number" ||
        !Number.isInteger(amount) ||
        !VALID_TIP_AMOUNTS_PAISE.has(amount)
      ) {
        return Response.json({ error: GENERIC_ERROR }, { status: 400 });
      }
      amountPaise = amount;
    }

    if (amountPaise < MIN_AMOUNT_PAISE) {
      return Response.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const convex = getConvex();
    if (!convex) {
      return Response.json({ error: GENERIC_ERROR }, { status: 500 });
    }

    // Require the user to exist (onboarded) before accepting payment.
    // Self-heal: if caller sends a localStorage profile, upsert on the fly so users
    // whose onboarding hit a different Convex deployment don't get stranded.
    let existingUser = await convex.query(api.users.getByEmail, { email });
    if (!existingUser && profile && typeof profile === "object") {
      const p = profile as Record<string, unknown>;
      try {
        await convex.mutation(api.users.upsert, {
          email,
          name: typeof p.name === "string" ? p.name : undefined,
          persona: typeof p.persona === "string" ? p.persona : undefined,
          expertiseLevel: typeof p.expertiseLevel === "string" ? p.expertiseLevel : undefined,
          savedCards: Array.isArray(p.savedCards) ? p.savedCards.filter((c): c is string => typeof c === "string") : undefined,
          upiPreferences: Array.isArray(p.upiPreferences) ? p.upiPreferences.filter((u): u is string => typeof u === "string") : undefined,
        });
        existingUser = await convex.query(api.users.getByEmail, { email });
      } catch (e) {
        console.warn("[razorpay/create-order] Self-heal upsert failed:", String(e).slice(0, 120));
      }
    }
    if (!existingUser) {
      return Response.json(
        { error: "Please complete onboarding before purchasing." },
        { status: 400 }
      );
    }

    const razorpay = getRazorpay();
    const receipt = `${kind}_${Date.now().toString(36)}`;

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        kind,
        email,
        ...(typeof notes === "string" ? { context: notes } : {}),
      },
    });

    // Hard-fail if Convex log write fails: ghost orders (Razorpay has it, Convex doesn't) are unrecoverable.
    try {
      await convex.mutation(api.payments.recordOrder, {
        userEmail: email,
        kind,
        amount: amountPaise,
        razorpayOrderId: order.id,
        notes: typeof notes === "string" ? notes : undefined,
      });
    } catch (e) {
      console.error("[razorpay/create-order] Convex log failed:", String(e).slice(0, 150));
      return Response.json({ error: GENERIC_ERROR }, { status: 503 });
    }

    return Response.json({
      orderId: order.id,
      amount: Math.floor(Number(order.amount)),
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      kind,
    });
  } catch (err) {
    console.error(
      "[razorpay/create-order] Error:",
      err instanceof Error ? err.message : String(err).slice(0, 200)
    );
    return Response.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}
