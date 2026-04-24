"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppHome() {
  const router = useRouter();

  useEffect(() => {
    const profile = localStorage.getItem("loot_profile");
    if (profile) {
      router.replace("/app/research");
    } else {
      router.replace("/app/onboard");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
