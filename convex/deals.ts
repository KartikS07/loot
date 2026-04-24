import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const log = mutation({
  args: {
    productName: v.string(),
    platform: v.string(),
    bestPrice: v.number(),
    marketHighPrice: v.number(),
    savedVsHighest: v.number(),
    userEmail: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("deals", {
      ...args,
      confirmedPurchase: false,
      createdAt: Date.now(),
    });
  },
});

export const confirm = mutation({
  args: { dealId: v.id("deals") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.dealId, { confirmedPurchase: true });
  },
});

export const getSummary = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = args.userEmail
      ? await ctx.db
          .query("deals")
          .withIndex("by_email", (q) => q.eq("userEmail", args.userEmail))
          .take(200)
      : await ctx.db.query("deals").take(200);

    const totalDealsFound = all.reduce((s, d) => s + d.savedVsHighest, 0);
    const confirmed = all.filter((d) => d.confirmedPurchase);
    const totalConfirmedSaved = confirmed.reduce((s, d) => s + d.savedVsHighest, 0);

    const bestDeal = [...all].sort((a, b) => b.savedVsHighest - a.savedVsHighest)[0];

    return {
      dealsCount: all.length,
      totalDealsFound,
      confirmedCount: confirmed.length,
      totalConfirmedSaved,
      bestDeal: bestDeal
        ? { productName: bestDeal.productName, saved: bestDeal.savedVsHighest }
        : null,
      recent: all
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10)
        .map((d) => ({
          id: d._id,
          productName: d.productName,
          platform: d.platform,
          savedVsHighest: d.savedVsHighest,
          confirmedPurchase: d.confirmedPurchase,
          createdAt: d.createdAt,
        })),
    };
  },
});
