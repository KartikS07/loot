import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    sessionId: v.string(),
    query: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("searches", {
      sessionId: args.sessionId,
      query: args.query,
      userId: args.userId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const updateResult = mutation({
  args: {
    sessionId: v.string(),
    results: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const search = await ctx.db
      .query("searches")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (!search) return;
    await ctx.db.patch(search._id, {
      results: args.results,
      status: args.status,
    });
  },
});

export const logAgentStep = mutation({
  args: {
    sessionId: v.string(),
    agentName: v.string(),
    step: v.string(),
    input: v.optional(v.string()),
    output: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentLogs", {
      sessionId: args.sessionId,
      agentName: args.agentName,
      step: args.step,
      input: args.input,
      output: args.output,
      tokensUsed: args.tokensUsed,
      durationMs: args.durationMs,
      status: args.status,
      createdAt: Date.now(),
    });
  },
});

export const getAgentLogs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .take(50);
  },
});
