import { redirect } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  searchParams: Promise<{ savings?: string; loots?: string; name?: string; persona?: string; best?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { savings, loots, name } = await searchParams;
  const savingsFormatted = savings ? `₹${parseInt(savings).toLocaleString("en-IN")}` : "₹0";
  const displayName = name ? `${name}'s` : "My";

  return {
    title: `${displayName} Loot Report — ${savingsFormatted} in deals found`,
    description: `${displayName} Loot Report: ${savingsFormatted} in deals found across ${loots ?? "0"} products. Not just a deal. A loot.`,
    openGraph: {
      title: `${displayName} Loot Report — ${savingsFormatted} in deals found`,
      description: `Stop overpaying. See how Loot finds the best price across 11 Indian platforms.`,
      type: "website",
    },
  };
}

// Redirect to app — this page exists purely for OG image generation
export default async function SharePage({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  redirect(`/app/savings${qs ? `?from_share=1` : ""}`);
}
