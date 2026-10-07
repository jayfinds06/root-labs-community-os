import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Users } from "lucide-react";
import logoSrc from "../public/logo.webp";
import mgSrc from "../public/mg.webp";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const EVENT_LABEL = "February 28, 2026";
const EVENT_TIME = "11AM PST";
const BASE_REGISTERED = 1024;

const agendaItems = [
  {
    title: "Founder framing",
    body: "The replay opens with the original company vision and launch positioning.",
  },
  {
    title: "100% commission offer",
    body: "The archive preserves the central creator economics pitch from the live event.",
  },
  {
    title: "Creator profile",
    body: "The event explains who the offer was built for and why the audience mattered.",
  },
  {
    title: "Product positioning",
    body: "The closing section covers the formulation story and premium product narrative.",
  },
] as const;

const productHighlights = [
  "10 forms of magnesium",
  "Beadlet delivery",
  "No added sugar",
  "Triple-action stack",
] as const;

const parseCurrency = (value: string): number => {
  const n = Number.parseFloat(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const fmt = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
};

const useInView = (threshold = 0.15) => {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
};

const App = () => {
  const [showSticky, setShowSticky] = useState(false);
  const [gmvInput, setGmvInput] = useState("");
  const [requestCount, setRequestCount] = useState(BASE_REGISTERED);
  const [commissionInput, setCommissionInput] = useState("50");

  const calcSection = useInView(0.18);
  const agendaSection = useInView(0.12);
  const productSection = useInView(0.12);

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetch("/api/registrations")
      .then((r) => r.json())
      .then((data: { count?: number }) => {
        if (typeof data.count === "number") {
          setRequestCount(BASE_REGISTERED + data.count);
        }
      })
      .catch(() => {});
  }, []);

  const gmv = useMemo(() => parseCurrency(gmvInput), [gmvInput]);
  const customRate = Math.min(100, Math.max(0, parseFloat(commissionInput) || 0));
  const currentEarnings = gmv * (customRate / 100);
  const rootLabsEarnings = gmv;
  const lift = rootLabsEarnings - currentEarnings;

  return (
    <div className="relative overflow-hidden">
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-border/80 bg-background/88 backdrop-blur-xl transition-transform duration-300 ${showSticky ? "translate-y-0" : "-translate-y-full"}`}
      >
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="Root Labs" className="h-5 w-auto" />
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Launch archive
            </span>
          </div>
          <Button asChild size="sm">
            <a href="/register">Request replay</a>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-12 pt-20 sm:px-6 lg:px-8">
        <section className="rounded-[28px] border border-border/80 bg-card/92 shadow-[0_28px_80px_rgba(0,0,0,0.44)] backdrop-blur-xl">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:p-10">
            <div className="space-y-6">
              <img src={logoSrc} alt="Root Labs" className="h-12 w-auto sm:h-14" />

              <div className="space-y-4">
                <h1 className="max-w-3xl font-display text-5xl leading-none tracking-[-0.06em] text-foreground sm:text-6xl lg:text-7xl">
                  Replay the Root Labs launch with the right context.
                </h1>
                <p className="max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl">
                  The live event is over. This page now serves as a clean archive
                  for the launch held on {EVENT_LABEL}.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="min-w-48">
                  <a href="/register">
                    Request replay access
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="min-w-48">
                  <a href="#launch-highlights">View highlights</a>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <Card className="border-border/80 bg-background/72 shadow-none">
                <CardContent className="p-5">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground">
                    Event date
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{EVENT_LABEL}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{EVENT_TIME}</p>
                </CardContent>
              </Card>
              <Card className="border-border/80 bg-background/72 shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="size-4" />
                    <p className="text-[0.68rem] uppercase tracking-[0.22em]">Requests</p>
                  </div>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {requestCount.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Original registrations and replay follow-up.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/80 bg-background/72 shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="size-4" />
                    <p className="text-[0.68rem] uppercase tracking-[0.22em]">Offer</p>
                  </div>
                  <p className="mt-2 text-xl font-semibold text-foreground">100% commission</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The core economics message from the launch.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section
          ref={calcSection.ref as React.RefObject<HTMLElement>}
          className={`transition duration-700 ${calcSection.visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        >
          <Card className="rounded-[28px] border-border/80 bg-card/92 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="font-display text-4xl tracking-[-0.04em]">
                Commission comparison
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7">
                A simple replay-friendly version of the offer comparison shown during the launch.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="gmv">
                    Your monthly GMV
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="gmv"
                      inputMode="decimal"
                      placeholder="10,000"
                      value={gmvInput}
                      onChange={(e) => setGmvInput(e.target.value)}
                      className="border-border/80 bg-background/72 pl-8 hover:border-white/18 focus-visible:bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="commission">
                    Your current commission rate
                  </label>
                  <div className="relative">
                    <Input
                      id="commission"
                      inputMode="decimal"
                      placeholder="50"
                      value={commissionInput}
                      onChange={(e) => setCommissionInput(e.target.value)}
                      className="border-border/80 bg-background/72 pr-8 hover:border-white/18 focus-visible:bg-background"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              </div>

              <Card className="rounded-[24px] border-border/80 bg-background/80 shadow-none">
                <CardHeader>
                  <CardTitle className="text-xl tracking-[-0.03em]">Earnings comparison</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-card/78 px-4 py-3 text-sm">
                    <span>{customRate}% commission</span>
                    <strong>{fmt(currentEarnings)}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-primary/24 bg-primary/[0.12] px-4 py-3 text-sm">
                    <span>100% commission</span>
                    <strong>{fmt(rootLabsEarnings)}</strong>
                  </div>
                  {gmv > 0 ? (
                    <div className="rounded-2xl border border-primary/20 bg-primary/[0.08] px-4 py-4 text-sm leading-6 text-foreground">
                      You'd make <strong>{fmt(lift)}</strong> more under the launch offer structure.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </section>

        <section
          id="launch-highlights"
          ref={agendaSection.ref as React.RefObject<HTMLElement>}
          className={`transition duration-700 ${agendaSection.visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        >
          <Card className="rounded-[28px] border-border/80 bg-card/92 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="font-display text-4xl tracking-[-0.04em]">
                Replay highlights
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7">
                The archive keeps the original launch structure readable without pretending the event is still upcoming.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {agendaItems.map((item) => (
                <Card key={item.title} className="rounded-[24px] border-border/80 bg-background/80 shadow-none">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-2xl tracking-[-0.03em]">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </section>

        <section
          ref={productSection.ref as React.RefObject<HTMLElement>}
          className={`transition duration-700 ${productSection.visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
        >
          <Card className="rounded-[28px] border-border/80 bg-card/92 backdrop-blur-xl">
            <CardContent className="grid gap-8 p-6 lg:grid-cols-[0.82fr_1fr] lg:p-8">
              <div className="rounded-[24px] border border-border/80 bg-background/80 p-6">
                <div className="relative overflow-hidden rounded-[22px] border border-primary/16 bg-gradient-to-b from-primary/[0.08] via-background to-background p-6">
                  <img
                    src={mgSrc}
                    alt="Magnesium + Ashwagandha Gummies"
                    className="mx-auto h-auto max-h-[28rem] w-full object-contain"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="font-display text-4xl leading-none tracking-[-0.04em] sm:text-5xl">
                    Magnesium + ashwagandha gummies
                  </h2>
                  <p className="text-base leading-7 text-muted-foreground">
                    The replay preserves the product story alongside the creator economics pitch.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {productHighlights.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-border/80 bg-background/78 px-4 py-4 text-sm text-foreground"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-[28px] border-border/80 bg-card/92 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="font-display text-4xl tracking-[-0.04em]">
              Request the replay.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              The archive is available now. The form is positioned only as a replay request and follow-up step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg">
              <a href="/register">
                Request replay access
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
          <p className="font-medium uppercase tracking-[0.2em] text-foreground">
            Root Labs launch archive
          </p>
          <p>
            Held live on {EVENT_LABEL} at {EVENT_TIME}. This page now serves as the archive.
          </p>
          <Separator />
          <p>Contact your administrator for a Discord invite.</p>
          <p>© 2026 Root Labs</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
