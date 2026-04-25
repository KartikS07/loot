import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const kindValidator = v.union(v.literal("tip"), v.literal("premium"));

// Timing-safe equality on hex strings. Avoids leaking comparison position via early exit.
function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Verify Razorpay webhook/payment signature using Web Crypto (Convex V8 runtime).
// Returns true only on valid SHA256 HMAC. Invalid hex or mismatched signatures return false.
async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET not set in Convex env");
  }
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${orderId}|${paymentId}`)
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeHexEqual(expected, signature.toLowerCase());
}

// Record a Razorpay order at creation time. Status = "created" until verify step.
export const recordOrder = mutation({
  args: {
    userEmail: v.string(),
    kind: kindValidator,
    amount: v.number(),
    razorpayOrderId: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("payments", {
      userEmail: args.userEmail,
      kind: args.kind,
      amount: args.amount,
      currency: "INR",
      status: "created",
      razorpayOrderId: args.razorpayOrderId,
      notes: args.notes,
      createdAt: Date.now(),
    });
  },
});

// After signature verification, mark paid + grant premium if kind=premium.
// Signature is re-verified HERE (defense in depth — makes this safe as a public mutation).
export const markPaid = mutation({
  args: {
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.string(),
  },
  handler: async (ctx, args) => {
    const validSig = await verifyRazorpaySignature(
      args.razorpayOrderId,
      args.razorpayPaymentId,
      args.razorpaySignature
    );
    if (!validSig) {
      throw new Error("Invalid signature");
    }

    const payment = await ctx.db
      .query("payments")
      .withIndex("by_order_id", (q) => q.eq("razorpayOrderId", args.razorpayOrderId))
      .first();

    if (!payment) {
      throw new Error(`Payment row not found for order ${args.razorpayOrderId}`);
    }

    // Idempotency: short-circuit if already processed. Prevents duplicate side effects.
    if (payment.status === "paid") {
      return { ok: true, kind: payment.kind, idempotent: true };
    }

    await ctx.db.patch(payment._id, {
      status: "paid",
      razorpayPaymentId: args.razorpayPaymentId,
      razorpaySignature: args.razorpaySignature,
      verifiedAt: Date.now(),
    });

    if (payment.kind === "premium") {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", payment.userEmail))
        .first();

      if (!user) {
        // Surfaces up so the API route can tell the user to complete onboarding.
        // The payment row is already marked "paid" — support can manually grant later.
        throw new Error(`User not onboarded for ${payment.userEmail}`);
      }

      await ctx.db.patch(user._id, {
        premiumTier: "lifetime",
        premiumUnlockedAt: Date.now(),
      });
    }

    return { ok: true, kind: payment.kind, idempotent: false };
  },
});

export const getByOrderId = query({
  args: { razorpayOrderId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_order_id", (q) => q.eq("razorpayOrderId", args.razorpayOrderId))
      .first();
  },
});

// Bounded list (not paginated). Upgrade to paginationOpts if history UI ever needs deep scroll.
export const listByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_email", (q) => q.eq("userEmail", args.email))
      .order("desc")
      .take(50);
  },
});
