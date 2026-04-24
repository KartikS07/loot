import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    persona: v.optional(v.string()),
    expertiseLevel: v.optional(v.string()),
    savedCards: v.optional(v.array(v.string())),
    upiPreferences: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.name !== undefined && { name: args.name }),
        ...(args.persona !== undefined && { persona: args.persona }),
        ...(args.expertiseLevel !== undefined && { expertiseLevel: args.expertiseLevel }),
        ...(args.savedCards !== undefined && { savedCards: args.savedCards }),
        ...(args.upiPreferences !== undefined && { upiPreferences: args.upiPreferences }),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      persona: args.persona,
      expertiseLevel: args.expertiseLevel,
      savedCards: args.savedCards,
      upiPreferences: args.upiPreferences,
      totalSaved: 0,
      searchCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});
