import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    source: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    persona: v.optional(v.string()),
    expertiseLevel: v.optional(v.string()),
    savedCards: v.optional(v.array(v.string())),
    upiPreferences: v.optional(v.array(v.string())),
    totalSaved: v.optional(v.number()),
    searchCount: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  searches: defineTable({
    userId: v.optional(v.id("users")),
    sessionId: v.string(),
    query: v.string(),
    clarifications: v.optional(v.string()),
    results: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),

  wishlist: defineTable({
    userId: v.id("users"),
    productName: v.string(),
    productUrl: v.optional(v.string()),
    targetPrice: v.optional(v.number()),
    currentBestPrice: v.optional(v.number()),
    platform: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    addedAt: v.number(),
  }).index("by_user", ["userId"]),

  agentLogs: defineTable({
    sessionId: v.string(),
    agentName: v.string(),
    step: v.string(),
    input: v.optional(v.string()),
    output: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    status: v.string(),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),
});
