import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

const getConvex = () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
};

// POST /api/deals — log a deal (auto-called on "Buy on Platform" click)
// PATCH /api/deals — confirm a purchase ("Did you buy it?" → Yes)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productName, platform, bestPrice, marketHighPrice, userEmail, sessionId } = body;

    if (!productName || !platform || !bestPrice) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const savedVsHighest = Math.max(0, (marketHighPrice ?? bestPrice) - bestPrice);
    const convex = getConvex();

    if (convex) {
      const dealId = await convex.mutation(api.deals.log, {
        productName,
        platform,
        bestPrice: Math.round(bestPrice),
        marketHighPrice: Math.round(marketHighPrice ?? bestPrice),
        savedVsHighest: Math.round(savedVsHighest),
        userEmail: userEmail || undefined,
        sessionId: sessionId || undefined,
      });
      return Response.json({ success: true, dealId });
    }
    return Response.json({ success: true, dealId: null });
  } catch (err) {
    console.error("[deals/log]", err);
    return Response.json({ error: "Failed to log deal" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { dealId } = await req.json();
    if (!dealId) return Response.json({ error: "dealId required" }, { status: 400 });
    const convex = getConvex();
    if (convex) {
      await convex.mutation(api.deals.confirm, { dealId: dealId as Id<"deals"> });
    }
    return Response.json({ success: true });
  } catch (err) {
    console.error("[deals/confirm]", err);
    return Response.json({ error: "Failed to confirm" }, { status: 500 });
  }
}
