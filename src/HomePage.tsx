import { ArrowUpRight } from "lucide-react";
import logoSrc from "../public/logo.webp";
import { Button } from "@/components/ui/button";

const HomePage = () => {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_20%),linear-gradient(180deg,#050505_0%,#000000_100%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20 [mask-image:radial-gradient(circle_at_center,black,transparent_82%)]" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between rounded-full border border-white/8 bg-white/[0.02] px-4 py-3 backdrop-blur-xl sm:px-5">
          <img src={logoSrc} alt="Root Labs" className="h-8 w-auto" />
          <a
            href="#/dashboard"
            className="text-sm font-medium uppercase tracking-[0.14em] text-white/58 transition-colors hover:text-white"
          >
            Ops
          </a>
        </header>

        <section className="flex flex-1 items-center justify-center py-16 sm:py-24">
          <div className="w-full max-w-3xl rounded-[32px] border border-white/8 bg-white/[0.02] px-6 py-12 text-center shadow-[0_30px_120px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:px-10 sm:py-16">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-8">
              <img src={logoSrc} alt="Root Labs" className="h-14 w-auto opacity-95 sm:h-16" />

              <div className="space-y-4">
                <p className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-white/42">
                  Ops dashboard
                </p>
                <h1 className="font-display text-4xl tracking-[-0.08em] text-white sm:text-5xl lg:text-6xl">
                  One surface. No public clutter.
                </h1>
                <p className="mx-auto max-w-xl text-base leading-7 text-white/52 sm:text-lg">
                  Ultra-minimal entry point for the ops workspace.
                </p>
              </div>

              <Button
                asChild
                size="lg"
                className="min-w-44 rounded-full border border-white/10 bg-white text-black shadow-[0_18px_44px_rgba(255,255,255,0.08)] hover:bg-white/92"
              >
                <a href="#/dashboard">
                  Open Dashboard
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default HomePage;
