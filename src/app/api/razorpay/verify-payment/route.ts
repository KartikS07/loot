import crypto from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const GENERIC_ERROR = "Payment verification failed";
const HEX_64 = /^[a-f0-9]{64}$/i;
const RZP_ID_FORMAT = /^[A-Za-z0-9_-]+$/;

const getConvex = () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body as {
      razorpay_order_id?: unknown;
      razorpay_payment_id?: unknown;
      razorpay_signature?: unknown;
    };

    // Strict shape + format validation before any comparison.
    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string" ||
      !RZP_ID_FORMAT.test(razorpay_order_id) ||
      !RZP_ID_FORMAT.test(razorpay_payment_id) ||
      !HEX_64.test(razorpay_signature)
    ) {
      return Response.json({ verified: false, error: GENERIC_ERROR }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("[razorpay/verify-payment] Missing RAZORPAY_KEY_SECRET");
      return Response.json({ verified: false, error: GENERIC_ERROR }, { status: 500 });
    }

    // Fast-fail signature check at the edge. markPaid will re-verify inside Convex
    // as defense in depth (so the public mutation cannot be tricked if called directly).
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(razorpay_signature, "hex");
    const sameLen = a.length === 32 && b.length === 32;
    const verified = sameLen && crypto.timingSafeEqual(a, b);

    if (!verified) {
      console.warn("[razorpay/verify-payment] Signature mismatch", { razorpay_order_id });
      return Response.json({ verified: false, error: GENERIC_ERROR }, { status: 400 });
    }

    const convex = getConvex();
    if (!convex) {
      return Response.json({ verified: false, error: GENERIC_ERROR }, { status: 503 });
    }

    try {
      const result = await convex.mutation(api.payments.markPaid, {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });
      return Response.json({ verified: true, kind: result.kind, idempotent: result.idempotent });
    } catch (mutationErr) {
      console.error(
        "[razorpay/verify-payment] markPaid failed:",
        mutationErr instanceof Error ? mutationErr.message : String(mutationErr).slice(0, 200)
      );
      return Response.json({ verified: false, error: GENERIC_ERROR }, { status: 500 });
    }
  } catch (err) {
    console.error(
      "[razorpay/verify-payment] Error:",
      err instanceof Error ? err.message : String(err).slice(0, 200)
    );
    return Response.json({ verified: false, error: GENERIC_ERROR }, { status: 500 });
  }
}
