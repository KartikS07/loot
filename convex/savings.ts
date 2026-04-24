import { query } from "./_generated/server";
import { v } from "convex/values";

export const getReport = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    const searches = user
      ? await ctx.db
          .query("searches")
          .withIndex("by_session", (q) => q.eq("sessionId", user._id as unknown as string))
          .take(50)
      : [];

    // Count completed research sessions from agentLogs
    const allLogs = await ctx.db.query("agentLogs").take(500);
    const userSessions = allLogs.filter(
      (l) => l.status === "complete" && l.agentName === "researcher"
    );

    const feedbackAll = await ctx.db.query("feedback").take(200);
    const userFeedback = args.email
      ? feedbackAll.filter((f) => f.userEmail === args.email)
      : [];

    return {
      user: user ?? null,
      researchCount: userSessions.length,
      feedbackCount: userFeedback.length,
      positiveCount: userFeedback.filter((f) => f.rating === "up").length,
    };
  },
});
