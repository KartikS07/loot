"use server";

import { ConvexHttpClient } from "convex/browser";

const getClient = () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
};

export async function joinWaitlist(
  email: string,
  source?: string
): Promise<{ success: boolean; alreadyJoined?: boolean; error?: string }> {
  try {
    const client = getClient();
    if (!client) {
      console.log("[waitlist] Convex not configured. Email:", email);
      return { success: true };
    }

    const { api } = await import("../../convex/_generated/api");
    const result = await client.mutation(api.waitlist.add, { email, source });
    return { success: true, alreadyJoined: result.alreadyJoined };
  } catch (err) {
    console.error("[waitlist] Error:", err);
    return { success: false, error: "Something went wrong. Try again." };
  }
}
