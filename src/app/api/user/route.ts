import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, persona, expertiseLevel, savedCards, upiPreferences } = body;

    if (!email || !email.includes("@")) {
      return Response.json({ error: "Valid email required" }, { status: 400 });
    }

    const userId = await convex.mutation(api.users.upsert, {
      email,
      name,
      persona,
      expertiseLevel,
      savedCards,
      upiPreferences,
    });

    return Response.json({ success: true, userId });
  } catch (err) {
    console.error("[user] Error:", err);
    return Response.json({ error: "Failed to save profile" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email) return Response.json({ error: "Email required" }, { status: 400 });

  try {
    const user = await convex.query(api.users.getByEmail, { email });
    return Response.json({ user });
  } catch (err) {
    console.error("[user] GET error:", err);
    return Response.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
