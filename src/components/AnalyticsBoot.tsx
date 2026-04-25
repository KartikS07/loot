"use client";

import { useEffect } from "react";
import { identifyUser, track } from "@/lib/analytics";

// Mount once at the app root. Re-identifies the user from localStorage so PostHog
// stitches sessions across visits, and fires a "session_start" event so we can see
// the funnel even before the user touches a feature.
export function AnalyticsBoot() {
  useEffect(() => {
    try {
      const email = localStorage.getItem("loot_email") ?? "";
      const profileRaw = localStorage.getItem("loot_profile") ?? "";
      const profile = profileRaw ? JSON.parse(profileRaw) : {};
      if (email) {
        identifyUser(email, {
          email,
          name: profile.name,
          persona: profile.persona,
          expertiseLevel: profile.expertiseLevel,
        });
      }
      track("session_start");
    } catch {
      // never break the app over analytics
    }
  }, []);
  return null;
}
