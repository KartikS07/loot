import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const add = mutation({
  args: { email: v.string(), source: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) return { alreadyJoined: true };

    await ctx.db.insert("waitlist", {
      email: args.email,
      source: args.source,
      createdAt: Date.now(),
    });

    return { alreadyJoined: false };
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("waitlist").collect();
    return entries.length;
  },
});
