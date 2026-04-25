"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

type CheckoutKind = "tip" | "premium";

type FailureReason =
  | "no-email"
  | "no-amount"
  | "script-load"
  | "create-order"
  | "no-key"
  | "dismissed"
  | "verify-failed"
  | "verify-error"
  | "unknown";

type PaymentIds = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
};

type Props = {
  kind: CheckoutKind;
  email: string;
  name?: string;
  contact?: string;                              // optional phone for Razorpay prefill
  amountPaise?: number;                          // required for tip; ignored for premium
  label: string;
  description?: string;
  notes?: string;
  className?: string;
  disabled?: boolean;
  onSuccess?: (kind: CheckoutKind) => void;
  onFailure?: (reason: FailureReason, paymentIds?: PaymentIds) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: { email?: string; name?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
};

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

// Shared promise so concurrent callers don't append duplicate <script> tags.
let scriptLoadPromise: Promise<boolean> | null = null;

function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve) => {
    const existing = document.querySelector(
      `script[src="${CHECKOUT_SCRIPT_SRC}"]`
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener("error", () => {
        scriptLoadPromise = null;
        resolve(false);
      });
      return;
    }

    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      scriptLoadPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return scriptLoadPromise;
}

export function RazorpayCheckoutButton({
  kind,
  email,
  name,
  contact,
  amountPaise,
  label,
  description,
  notes,
  className,
  disabled,
  onSuccess,
  onFailure,
}: Props) {
  // useRef guard closes the double-click window that a useState-only check leaves open.
  const busyRef = useRef(false);
  const [busyState, setBusyState] = useState(false);

  useEffect(() => {
    void loadCheckoutScript();
  }, []);

  const handleClick = useCallback(async () => {
    if (busyRef.current || disabled) return;
    busyRef.current = true;
    setBusyState(true);

    try {
      if (!email) {
        toast.error("Please complete onboarding first (we need your email).");
        onFailure?.("no-email");
        return;
      }
      if (kind === "tip" && !amountPaise) {
        toast.error("Tip amount missing.");
        onFailure?.("no-amount");
        return;
      }

      const scriptReady = await loadCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        console.warn("[checkout] Razorpay script failed to load");
        toast.error("Couldn't load Razorpay. Check your connection.");
        onFailure?.("script-load");
        return;
      }

      // Pass localStorage profile so the server can self-heal a missing user record
      // (e.g. user onboarded before a Convex routing switch).
      let profile: unknown = undefined;
      try {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem("loot_profile") : null;
        if (raw) profile = JSON.parse(raw);
      } catch {
        // ignore malformed localStorage — server will fall back to the onboarding gate
      }

      track("checkout_started", { kind, amount: amountPaise ?? null });

      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, kind, amount: amountPaise, notes, profile }),
      });

      if (!orderRes.ok) {
        const body = await orderRes.json().catch(() => ({}));
        toast.error(body.error || "Couldn't start checkout.");
        onFailure?.("create-order");
        return;
      }

      const { orderId, amount, currency, keyId } = (await orderRes.json()) as {
        orderId: string;
        amount: number;
        currency: string;
        keyId?: string;
      };

      if (!keyId) {
        console.error("[checkout] Razorpay key missing in response");
        toast.error("Razorpay key missing. Contact support.");
        onFailure?.("no-key");
        return;
      }

      const rzp = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: "Loot",
        description:
          description ?? (kind === "premium" ? "Loot Premium — Lifetime" : "Tip Loot"),
        order_id: orderId,
        prefill: {
          email,
          ...(name ? { name } : {}),
          ...(contact ? { contact } : {}),
        },
        notes: { kind },
        theme: { color: "#0ea5e9" },
        handler: async (resp) => {
          try {
            const verifyRes = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resp),
            });
            const verifyBody = (await verifyRes
              .json()
              .catch(() => ({ verified: false }))) as {
              verified: boolean;
              kind?: CheckoutKind;
              error?: string;
            };

            if (verifyRes.ok && verifyBody.verified) {
              if (verifyBody.kind && verifyBody.kind !== kind) {
                console.warn(
                  "[checkout] kind mismatch",
                  { requested: kind, confirmed: verifyBody.kind }
                );
              }
              track(kind === "premium" ? "premium_unlocked" : "tip_paid", {
                amount: amountPaise ?? null,
                orderId: resp.razorpay_order_id,
              });
              toast.success(
                kind === "premium"
                  ? "Premium unlocked. Enjoy the Loot."
                  : "Thanks for the tip. You rock."
              );
              onSuccess?.(kind);
            } else {
              // User was charged but verify failed. Preserve IDs so caller can offer retry / support.
              toast.error(
                "Payment received but verification hit a snag. Your order & payment IDs have been saved — we'll help you recover."
              );
              onFailure?.("verify-failed", {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
              });
            }
          } catch (e) {
            console.error("[checkout] verify error:", e);
            toast.error("Verification error. Contact support with your payment id.");
            onFailure?.("verify-error", {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
            });
          }
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment cancelled. No charge.");
            onFailure?.("dismissed");
          },
        },
      });

      rzp.open();
    } catch (e) {
      console.error("[checkout] error:", e);
      toast.error("Checkout hit an unexpected error. Refresh and try again.");
      onFailure?.("unknown");
    } finally {
      busyRef.current = false;
      setBusyState(false);
    }
  }, [disabled, kind, email, amountPaise, name, contact, description, notes, onSuccess, onFailure]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busyState}
      aria-busy={busyState}
      aria-live="polite"
      className={className}
    >
      {busyState ? "Loading…" : label}
    </button>
  );
}
