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
    premiumTier: v.optional(v.union(v.literal("none"), v.literal("lifetime"))),
    premiumUnlockedAt: v.optional(v.number()),  // ms epoch when paid
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

  deals: defineTable({
    productName: v.string(),
    platform: v.string(),
    bestPrice: v.number(),
    marketHighPrice: v.number(),
    savedVsHighest: v.number(),
    confirmedPurchase: v.boolean(),
    userEmail: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["userEmail"]),

  feedback: defineTable({
    module: v.string(),       // "researcher" | "price_optimizer"
    rating: v.string(),       // "up" | "down"
    productName: v.string(),
    comment: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_module", ["module"]),

  payments: defineTable({
    userEmail: v.string(),
    kind: v.union(v.literal("tip"), v.literal("premium")),
    amount: v.number(),                          // paise
    currency: v.literal("INR"),
    status: v.union(v.literal("created"), v.literal("paid"), v.literal("failed")),
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.optional(v.string()),
    razorpaySignature: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["userEmail"])
    .index("by_order_id", ["razorpayOrderId"]),
});
