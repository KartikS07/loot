"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RazorpayCheckoutButton } from "./RazorpayCheckoutButton";

type ProductContext = {
  name: string;
  specs?: Record<string, string>;
  pros?: string[];
  cons?: string[];
  tagline?: string;
};

type DeepDive = {
  specAnalysis: string;
  failureModes: string[];
  maintenanceCost: string;
  whatToAvoid: string[];
  bestUseCase: string;
};

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  product: ProductContext | null;
  email: string;
  isPremium: boolean;
  onPremiumUnlocked?: () => void;
};

const STATUS_MESSAGES = [
  "Studying the specs…",
  "Comparing real-world reports…",
  "Ranking failure modes…",
];

export function DeepDiveModal({
  open,
  onOpenChange,
  product,
  email,
  isPremium,
  onPremiumUnlocked,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [data, setData] = useState<DeepDive | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bridges the ~200-500ms window between Razorpay success and Convex refetching isPremium=true.
  // During this gap, we show "Activating premium…" instead of the paywall.
  const [justUnlocked, setJustUnlocked] = useState(false);

  // Stale-response guard + in-flight abort + unmount cancel.
  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  // Focus management: capture the element that had focus before the modal opened
  // and restore it on close for keyboard / screen-reader continuity.
  const triggerRef = useRef<Element | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const fetchDeepDive = useCallback(async () => {
    if (!product || !email || !isPremium) return;

    // Cancel any prior in-flight request.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    await Promise.resolve();
    const myReqId = ++reqIdRef.current;

    setLoading(true);
    setError(null);
    setData(null);
    setStatusIdx(0);

    try {
      const res = await fetch("/api/deep-dive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          productName: product.name,
          productContext: {
            specs: product.specs,
            pros: product.pros,
            cons: product.cons,
            tagline: product.tagline,
          },
        }),
        signal: controller.signal,
      });

      if (cancelledRef.current || reqIdRef.current !== myReqId) return;

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (cancelledRef.current || reqIdRef.current !== myReqId) return;
        setError(
          body?.error === "premium required" ? "This needs Premium." : "Deep dive failed. Try again."
        );
        return;
      }

      const json = (await res.json()) as DeepDive;
      if (cancelledRef.current || reqIdRef.current !== myReqId) return;
      setData(json);
    } catch (e) {
      // AbortError is expected when the modal closes or product changes mid-flight.
      if ((e as { name?: string })?.name === "AbortError") return;
      if (cancelledRef.current || reqIdRef.current !== myReqId) return;
      setError("Deep dive failed. Try again.");
    } finally {
      if (!cancelledRef.current && reqIdRef.current === myReqId) setLoading(false);
    }
  }, [product, email, isPremium]);

  // Open: capture trigger + kick off fetch for premium users.
  // Close: abort any in-flight request, reset state.
  // isPremium flips true (post-unlock): clear justUnlocked bridge.
  useEffect(() => {
    cancelledRef.current = false;

    if (open) {
      if (typeof document !== "undefined") {
        triggerRef.current = document.activeElement;
      }
      if (isPremium && product) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchDeepDive defers state via await Promise.resolve()
        void fetchDeepDive();
        setJustUnlocked(false);
      }
    } else {
      abortRef.current?.abort();
      abortRef.current = null;
      reqIdRef.current++;
      Promise.resolve().then(() => {
        if (cancelledRef.current) return;
        setLoading(false);
        setData(null);
        setError(null);
        setJustUnlocked(false);
      });
      // Return focus to the element that opened the modal.
      const trigger = triggerRef.current as HTMLElement | null;
      if (trigger && typeof trigger.focus === "function") {
        trigger.focus();
      }
      triggerRef.current = null;
    }

    return () => {
      cancelledRef.current = true;
    };
  }, [open, isPremium, product, fetchDeepDive]);

  // Rotate loading status messages every 4s.
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, [loading]);

  // Keyboard handlers: Escape closes; Tab cycles focus inside the modal (basic trap).
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    closeBtnRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Expert Deep Dive for ${product.name}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <div ref={panelRef} className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-6 pb-4 bg-zinc-950 border-b border-zinc-900">
          <div>
            <div className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1">
              Expert Deep Dive
            </div>
            <h2 className="text-xl font-black text-white leading-tight">{product.name}</h2>
            {product.tagline && (
              <p className="text-zinc-500 text-xs mt-1">{product.tagline}</p>
            )}
          </div>
          <button
            ref={closeBtnRef}
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="shrink-0 w-8 h-8 rounded-full border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-sm transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 pt-4">
          {/* isPremium=false, but NOT mid-unlock: show paywall */}
          {!isPremium && !justUnlocked && (
            <NonPremiumView
              email={email}
              onUnlocked={() => {
                setJustUnlocked(true);
                onPremiumUnlocked?.();
                // Do NOT close — once isPremium flips via Convex refetch, the
                // parent useEffect fires fetchDeepDive and the view switches
                // to LoadingView → ResultView automatically. justUnlocked
                // bridges the ~200-500ms gap so the paywall doesn't flash back.
              }}
            />
          )}

          {/* Post-unlock bridge: Convex hasn't refetched yet. Reassure user. */}
          {!isPremium && justUnlocked && (
            <LoadingView statusIdx={0} overrideMessage="Activating premium…" />
          )}

          {isPremium && loading && (
            <LoadingView statusIdx={statusIdx} />
          )}

          {isPremium && !loading && error && (
            <ErrorView onRetry={fetchDeepDive} message={error} />
          )}

          {isPremium && !loading && !error && data && (
            <ResultView data={data} />
          )}
        </div>
      </div>
    </div>
  );
}

function NonPremiumView({ email, onUnlocked }: { email: string; onUnlocked: () => void }) {
  return (
    <div className="space-y-5">
      <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4">
        <div className="text-amber-400 text-xs uppercase tracking-widest font-semibold mb-2">
          What you&apos;ll get
        </div>
        <ul className="text-zinc-300 text-sm space-y-1.5">
          <li>• A plain-English spec breakdown — what the numbers actually mean in daily use</li>
          <li>• The 3 most common failure modes for this product class</li>
          <li>• A realistic ₹ maintenance-cost estimate and what to avoid at checkout</li>
        </ul>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <p className="text-zinc-400 text-sm leading-relaxed">
          Unlock this for <span className="text-white font-semibold">every product</span>, on every
          search, forever — for <span className="text-amber-400 font-bold">₹199 lifetime</span>. No
          subscription, no auto-renew.
        </p>
      </div>

      <RazorpayCheckoutButton
        kind="premium"
        email={email}
        label="Unlock Premium — ₹199"
        className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-bold rounded-xl py-3 text-sm transition-colors"
        onSuccess={onUnlocked}
      />

      {!email && (
        <p className="text-zinc-600 text-xs text-center">
          Complete onboarding first so we can tie premium to your email.
        </p>
      )}
    </div>
  );
}

function LoadingView({
  statusIdx,
  overrideMessage,
}: {
  statusIdx: number;
  overrideMessage?: string;
}) {
  return (
    <div className="py-10 flex flex-col items-center gap-5">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-zinc-400 text-sm text-center min-h-[20px] transition-opacity">
        {overrideMessage ?? STATUS_MESSAGES[statusIdx]}
      </p>
      {!overrideMessage && (
        <p className="text-zinc-600 text-xs text-center">This usually takes 10–20 seconds.</p>
      )}
    </div>
  );
}

function ErrorView({ onRetry, message }: { onRetry: () => void; message: string }) {
  return (
    <div className="bg-red-400/10 border border-red-400/20 rounded-2xl p-6 text-center">
      <p className="text-red-400 text-sm mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl px-5 py-2.5 text-sm transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

function ResultView({ data }: { data: DeepDive }) {
  return (
    <div className="space-y-6">
      <Section title="Spec analysis">
        <p className="text-zinc-300 text-sm leading-relaxed">{data.specAnalysis}</p>
      </Section>

      <Section title="Failure modes">
        <ul className="space-y-2">
          {data.failureModes.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
              <span className="text-red-400 shrink-0 mt-0.5">▸</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Maintenance cost">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
          <p className="text-white text-sm font-medium">{data.maintenanceCost}</p>
        </div>
      </Section>

      <Section title="What to avoid">
        <ul className="space-y-2">
          {data.whatToAvoid.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
              <span className="text-amber-400 shrink-0 mt-0.5">!</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Best use case">
        <div className="bg-amber-400/5 border border-amber-400/10 rounded-xl px-4 py-3">
          <p className="text-zinc-200 text-sm leading-relaxed">{data.bestUseCase}</p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}
