"use client";

import { useState } from "react";

interface Props {
  module: "researcher" | "price_optimizer";
  productName: string;
  sessionId?: string;
  label?: string;
}

export function FeedbackWidget({ module, productName, sessionId, label }: Props) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showComment, setShowComment] = useState(false);

  async function submit(r: "up" | "down") {
    setRating(r);
    if (r === "up") {
      // Thumbs up — save immediately, no comment needed
      await save(r, "");
      setSubmitted(true);
    } else {
      // Thumbs down — ask for reason
      setShowComment(true);
    }
  }

  async function save(r: "up" | "down", c: string) {
    const email = typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("loot_profile") ?? "{}")?.email
      : undefined;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module, rating: r, productName,
          comment: c || undefined, userEmail: email, sessionId,
        }),
      });
    } catch { /* non-fatal */ }
  }

  async function submitWithComment() {
    if (rating) await save(rating, comment);
    setSubmitted(true);
    setShowComment(false);
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-600 py-2">
        <span>{rating === "up" ? "👍" : "👎"}</span>
        <span>Thanks for the feedback</span>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-zinc-900">
      <div className="flex items-center gap-3">
        <span className="text-zinc-600 text-xs">
          {label ?? "Was this helpful?"}
        </span>
        <button
          onClick={() => submit("up")}
          className="text-zinc-500 hover:text-green-400 text-lg transition-colors leading-none"
          aria-label="thumbs up"
        >
          👍
        </button>
        <button
          onClick={() => submit("down")}
          className="text-zinc-500 hover:text-red-400 text-lg transition-colors leading-none"
          aria-label="thumbs down"
        >
          👎
        </button>
      </div>

      {showComment && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What went wrong? (optional)"
            autoFocus
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/40"
            onKeyDown={(e) => e.key === "Enter" && submitWithComment()}
          />
          <button
            onClick={submitWithComment}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Submit →
          </button>
        </div>
      )}
    </div>
  );
}
