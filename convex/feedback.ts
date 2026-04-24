import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const submit = mutation({
  args: {
    module: v.string(),
    rating: v.string(),
    productName: v.string(),
    comment: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("feedback", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getStats = query({
  args: { module: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("feedback")
      .withIndex("by_module", (q) => q.eq("module", args.module))
      .take(1000);
    const up = all.filter((f) => f.rating === "up").length;
    const down = all.filter((f) => f.rating === "down").length;
    return { up, down, total: all.length };
  },
});
