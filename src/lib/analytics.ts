"use client";

import posthog from "posthog-js";

// Single source of truth for PostHog: lazy-init on first event so SSR doesn't crash,
// and silent no-op when the env var is missing (e.g. local dev without a key).

let initialized = false;

function ensureInit(): boolean {
  if (typeof window === "undefined") return false;
  if (initialized) return true;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return false;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage",
    autocapture: true,
  });
  initialized = true;
  return true;
}

type Traits = {
  email?: string;
  name?: string;
  persona?: string;
  expertiseLevel?: string;
  premiumTier?: string;
};

export function identifyUser(email: string, traits?: Traits) {
  if (!ensureInit()) return;
  try {
    posthog.identify(email, {
      email,
      ...(traits ?? {}),
    });
  } catch {
    // never break the app over analytics
  }
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!ensureInit()) return;
  try {
    posthog.capture(event, props);
  } catch {
    // swallow
  }
}

export function resetIdentity() {
  if (!ensureInit()) return;
  try {
    posthog.reset();
  } catch {
    // swallow
  }
}
