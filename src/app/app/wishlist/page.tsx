"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface WishlistItem {
  id: string;
  productName: string;
  platform?: string;
  bestPrice?: number;
  addedAt: number;
}

const WISHLIST_KEY = "loot_wishlist";

export function loadWishlist(): WishlistItem[] {
  try { return JSON.parse(localStorage.getItem(WISHLIST_KEY) ?? "[]"); }
  catch { return []; }
}

export function saveToWishlist(item: Omit<WishlistItem, "id" | "addedAt">) {
  const existing = loadWishlist();
  const alreadyExists = existing.some(
    (w) => w.productName.toLowerCase() === item.productName.toLowerCase()
  );
  if (alreadyExists) return false;
  const updated = [
    { ...item, id: `wish_${Date.now()}`, addedAt: Date.now() },
    ...existing,
  ].slice(0, 50);
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
  return true;
}

export function removeFromWishlist(id: string) {
  const updated = loadWishlist().filter((w) => w.id !== id);
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
}

export default function WishlistPage() {
  const router = useRouter();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(loadWishlist());
    setMounted(true);
  }, []);

  function remove(id: string) {
    removeFromWishlist(id);
    setItems((prev) => prev.filter((w) => w.id !== id));
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-5xl mb-6">📋</div>
        <h1 className="text-2xl font-black mb-3">Your wishlist is empty</h1>
        <p className="text-zinc-500 mb-8 max-w-md mx-auto">
          Save products from your research results or price comparisons to track them here.
          Hit the ♡ on any product card to save it.
        </p>
        <button
          onClick={() => router.push("/app/research")}
          className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl px-8 py-3 text-sm transition-colors"
        >
          Start researching →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black mb-1">Wishlist</h1>
          <p className="text-zinc-500 text-sm">{items.length} product{items.length !== 1 ? "s" : ""} saved</p>
        </div>
        <button
          onClick={() => router.push("/app/research")}
          className="text-sm text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-2 transition-all"
        >
          + Research more
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 flex items-center justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold truncate">{item.productName}</div>
              <div className="flex items-center gap-3 mt-1">
                {item.platform && (
                  <span className="text-zinc-600 text-xs">{item.platform}</span>
                )}
                {item.bestPrice && (
                  <span className="text-amber-400 text-xs font-medium">
                    ₹{item.bestPrice.toLocaleString("en-IN")}
                  </span>
                )}
                <span className="text-zinc-700 text-xs">
                  Saved {new Date(item.addedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => router.push(`/app/price?product=${encodeURIComponent(item.productName)}`)}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 border border-amber-400/30 hover:border-amber-400/60 rounded-lg px-3 py-1.5 transition-all"
              >
                Check price →
              </button>
              <button
                onClick={() => remove(item.id)}
                className="text-zinc-700 hover:text-red-400 text-sm transition-colors px-1.5"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
