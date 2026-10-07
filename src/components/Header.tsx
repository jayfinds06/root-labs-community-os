import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="space-y-4">
      <Badge variant="secondary" className="rounded-full px-3 py-1 text-[0.7rem] uppercase tracking-[0.2em]">
        Bun + React + Tailwind + TanStack Router + Drizzle
      </Badge>
      <div className="space-y-2">
        <h1 className="font-display text-4xl tracking-[-0.04em] text-foreground sm:text-5xl">
          JSON Landing
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Starter initialized with Bun server routes, TanStack Router on the frontend, and Bun SQLite using Drizzle ORM.
        </p>
      </div>
    </header>
  );
}

export default Header;
