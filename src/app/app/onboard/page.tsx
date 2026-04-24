"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PERSONAS = [
  { id: "value_hunter", emoji: "🎯", label: "Value Hunter", desc: "Best product for the price. Won't overpay for a brand name." },
  { id: "quality_seeker", emoji: "💎", label: "Quality Seeker", desc: "Best product, full stop. Price is secondary to performance." },
  { id: "brand_loyalist", emoji: "🏆", label: "Brand Loyalist", desc: "Trust certain brands. Want the best from what I know." },
];

const EXPERTISE = [
  { id: "beginner", label: "Beginner", desc: "Explain specs to me in plain English." },
  { id: "enthusiast", label: "Enthusiast", desc: "I know the basics, give me the details that matter." },
  { id: "expert", label: "Expert", desc: "Skip the basics, talk specs with me." },
];

const CARDS = ["HDFC", "ICICI", "SBI", "Axis", "Kotak", "IDFC", "HSBC", "Yes Bank"];
const UPI = ["PhonePe", "Google Pay", "Paytm", "Amazon Pay", "CRED"];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    email: "",
    name: "",
    persona: "",
    expertiseLevel: "",
    savedCards: [] as string[],
    upiPreferences: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  function toggleCard(card: string) {
    setData((d) => ({
      ...d,
      savedCards: d.savedCards.includes(card)
        ? d.savedCards.filter((c) => c !== card)
        : [...d.savedCards, card],
    }));
  }

  function toggleUpi(upi: string) {
    setData((d) => ({
      ...d,
      upiPreferences: d.upiPreferences.includes(upi)
        ? d.upiPreferences.filter((u) => u !== upi)
        : [...d.upiPreferences, upi],
    }));
  }

  async function finish() {
    setSaving(true);
    try {
      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      // Store email in localStorage for session
      localStorage.setItem("loot_email", data.email);
      localStorage.setItem("loot_profile", JSON.stringify(data));
      router.push("/app/research");
    } catch {
      setSaving(false);
    }
  }

  const steps = [
    // Step 0: Email + Name
    <div key="identity" className="space-y-6">
      <div>
        <h1 className="text-3xl font-black mb-2">Set up your Loot profile</h1>
        <p className="text-zinc-500">We use this to personalise every recommendation to you.</p>
      </div>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="text-zinc-400 text-sm mb-2 block">Your email</label>
          <input
            type="email"
            placeholder="you@email.com"
            value={data.email}
            onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/50 transition-all"
          />
        </div>
        <div>
          <label className="text-zinc-400 text-sm mb-2 block">Your name (optional)</label>
          <input
            type="text"
            placeholder="Kartik"
            value={data.name}
            onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/50 transition-all"
          />
        </div>
      </div>
    </div>,

    // Step 1: Persona
    <div key="persona" className="space-y-6">
      <div>
        <h2 className="text-3xl font-black mb-2">What kind of shopper are you?</h2>
        <p className="text-zinc-500">This shapes how Loot weights its recommendations.</p>
      </div>
      <div className="grid gap-4 max-w-xl">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setData((d) => ({ ...d, persona: p.id }))}
            className={`text-left p-5 rounded-2xl border transition-all ${
              data.persona === p.id
                ? "border-amber-400 bg-amber-400/10"
                : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">{p.emoji}</span>
              <span className="font-bold text-white">{p.label}</span>
            </div>
            <p className="text-zinc-500 text-sm">{p.desc}</p>
          </button>
        ))}
      </div>
    </div>,

    // Step 2: Expertise
    <div key="expertise" className="space-y-6">
      <div>
        <h2 className="text-3xl font-black mb-2">How much do you know about tech specs?</h2>
        <p className="text-zinc-500">Loot adjusts its explanation depth based on this.</p>
      </div>
      <div className="grid gap-4 max-w-xl">
        {EXPERTISE.map((e) => (
          <button
            key={e.id}
            onClick={() => setData((d) => ({ ...d, expertiseLevel: e.id }))}
            className={`text-left p-5 rounded-2xl border transition-all ${
              data.expertiseLevel === e.id
                ? "border-amber-400 bg-amber-400/10"
                : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
            }`}
          >
            <div className="font-bold text-white mb-1">{e.label}</div>
            <p className="text-zinc-500 text-sm">{e.desc}</p>
          </button>
        ))}
      </div>
    </div>,

    // Step 3: Cards
    <div key="cards" className="space-y-6">
      <div>
        <h2 className="text-3xl font-black mb-2">Which bank cards do you have?</h2>
        <p className="text-zinc-500">Loot applies your actual card discounts to every price comparison.</p>
      </div>
      <div className="flex flex-wrap gap-3 max-w-xl">
        {CARDS.map((card) => (
          <button
            key={card}
            onClick={() => toggleCard(card)}
            className={`px-5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              data.savedCards.includes(card)
                ? "border-amber-400 bg-amber-400/10 text-amber-400"
                : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            {card}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <p className="text-zinc-500 text-sm mb-3">UPI apps you use</p>
        <div className="flex flex-wrap gap-3">
          {UPI.map((u) => (
            <button
              key={u}
              onClick={() => toggleUpi(u)}
              className={`px-5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                data.upiPreferences.includes(u)
                  ? "border-blue-400 bg-blue-400/10 text-blue-400"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </div>,
  ];

  const canNext = [
    data.email.includes("@"),
    !!data.persona,
    !!data.expertiseLevel,
    true,
  ][step];

  return (
    <div className="max-w-2xl">
      {/* Progress */}
      <div className="flex gap-2 mb-10">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i <= step ? "bg-amber-400" : "bg-zinc-800"
            }`}
          />
        ))}
      </div>

      {steps[step]}

      <div className="flex items-center gap-4 mt-10">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            ← Back
          </button>
        )}
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl px-8 py-3 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={saving}
            className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl px-8 py-3 text-sm transition-colors disabled:opacity-60"
          >
            {saving ? "Setting up..." : "Start looting →"}
          </button>
        )}
        {step === steps.length - 1 && (
          <button
            onClick={() => router.push("/app/research")}
            className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
