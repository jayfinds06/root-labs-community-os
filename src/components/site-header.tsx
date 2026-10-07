import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

type SiteHeaderProps = {
  title?: string;
  subtitle?: string;
  statusLabel?: string;
  actions?: ReactNode;
};

export const SiteHeader = ({
  title,
  subtitle,
  statusLabel,
  actions,
}: SiteHeaderProps) => {
  return (
    <header className="shrink-0 border-b border-border/80 bg-background/88 backdrop-blur-xl">
      <div className="flex h-(--header-height) w-full items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ml-1 rounded-xl text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground" />
          <div className="min-w-0">
            {title ? (
              <p className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground/92">
                {title}
              </p>
            ) : null}
            {subtitle ? (
              <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {statusLabel ? (
            <div className="hidden rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground lg:inline-flex">
              {statusLabel}
            </div>
          ) : null}
          {actions ? <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
};
