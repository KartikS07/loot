import Link from "next/link";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <div className="min-h-screen bg-[#050505] text-white">
        {/* App nav */}
        <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 max-w-6xl mx-auto">
          <Link href="/" className="text-amber-400 font-black text-xl tracking-tight">Loot</Link>
          <div className="flex items-center gap-6">
            <Link href="/app/research" className="text-zinc-400 hover:text-white text-sm transition-colors">Research</Link>
            <Link href="/app/wishlist" className="text-zinc-400 hover:text-white text-sm transition-colors">Wishlist</Link>
            <Link href="/app/savings" className="text-zinc-400 hover:text-white text-sm transition-colors">Savings</Link>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
      </div>
      <Toaster richColors position="top-right" offset={72} />
    </ConvexClientProvider>
  );
}
