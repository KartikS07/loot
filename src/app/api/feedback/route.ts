import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const getConvex = () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { module, rating, productName, comment, userEmail, sessionId } = body;

    if (!module || !rating || !productName) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const convex = getConvex();
    if (convex) {
      await convex.mutation(api.feedback.submit, {
        module, rating, productName, comment, userEmail, sessionId,
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[feedback]", err);
    return Response.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
