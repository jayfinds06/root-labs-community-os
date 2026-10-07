import { type Icon } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { type SidebarAction } from "@/components/app-sidebar";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavMainItem = {
  title: string;
  url?: string;
  icon?: Icon;
  isActive?: boolean;
  badge?: string;
  onClick?: () => void;
  external?: boolean;
};

type NavMainProps = {
  items: NavMainItem[];
  primaryAction?: SidebarAction;
  utilityAction?: SidebarAction;
  syncStatusLabel?: string;
  syncDetailLabel?: string;
  lastSyncedAtLabel?: string;
};

export const NavMain = ({
  items,
  primaryAction,
  utilityAction,
  syncStatusLabel,
  syncDetailLabel,
  lastSyncedAtLabel,
}: NavMainProps) => {
  const UtilityIcon = utilityAction?.icon;
  const syncStateMeta = syncStatusLabel ?? "Ready";
  const utilityActionIsInternal =
    utilityAction?.href?.startsWith("/") &&
    !utilityAction.href.includes("?") &&
    !utilityAction.href.includes("#");
  const primaryActionClassName =
    "flex size-11 shrink-0 items-center justify-center rounded-full border border-sidebar-primary/22 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--sidebar-primary)_95%,white_5%),color-mix(in_oklab,var(--sidebar-primary)_74%,black_26%))] text-sidebar-primary-foreground shadow-[0_12px_30px_rgba(34,92,67,0.2)] transition-[filter,border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-sidebar-primary/30 hover:brightness-105 hover:shadow-[0_16px_34px_rgba(34,92,67,0.24)]";
  const utilityActionClassName =
    "flex size-11 shrink-0 items-center justify-center rounded-full border border-sidebar-border/70 bg-[radial-gradient(circle_at_34%_30%,rgba(88,255,170,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] text-sidebar-foreground/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[transform,border-color,color,box-shadow,background-color] duration-150 hover:-translate-y-px hover:border-sidebar-border hover:text-sidebar-foreground hover:shadow-[0_10px_24px_rgba(0,0,0,0.2)]";

  // Keep the top controls denser than the content cards so the sidebar reads like an app shell.
  return (
    <SidebarGroup className="px-2">
      <SidebarGroupContent className="flex flex-col gap-3">
        <div className="rounded-[1.15rem] border border-sidebar-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.028),rgba(255,255,255,0.012))] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/38">
                Sync
              </p>
              <p className="mt-1 text-[0.9rem] font-medium tracking-[-0.01em] text-sidebar-foreground/80">
                {syncStatusLabel ?? "Snapshot ready"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {primaryAction ? (
                <button
                  type="button"
                  className={primaryActionClassName}
                  onClick={primaryAction.onClick}
                  aria-label={primaryAction.label}
                  title={primaryAction.label}
                >
                  <primaryAction.icon className="size-4" />
                  <span className="sr-only">{primaryAction.label}</span>
                </button>
              ) : null}
              {utilityAction && UtilityIcon ? (
                utilityAction.href ? (
                  utilityActionIsInternal ? (
                    <Link
                      to={utilityAction.href}
                      className={utilityActionClassName}
                      aria-label={utilityAction.label}
                      title={utilityAction.label}
                    >
                      <UtilityIcon className="size-4" />
                    </Link>
                  ) : (
                    <a
                      href={utilityAction.href}
                      target={utilityAction.external ? "_blank" : undefined}
                      rel={utilityAction.external ? "noreferrer" : undefined}
                      className={utilityActionClassName}
                      aria-label={utilityAction.label}
                      title={utilityAction.label}
                    >
                      <UtilityIcon className="size-4" />
                    </a>
                  )
                ) : (
                  <button
                    type="button"
                    className={utilityActionClassName}
                    onClick={utilityAction.onClick}
                    aria-label={utilityAction.label}
                    title={utilityAction.label}
                  >
                    <UtilityIcon className="size-4" />
                  </button>
                )
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-[0.84rem] leading-5 text-sidebar-foreground/56">
            {syncDetailLabel ?? "The latest community view is available."}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 border-t border-sidebar-border/45 pt-2.5 text-[0.72rem]">
            <div className="min-w-0">
              <span className="uppercase tracking-[0.16em] text-sidebar-foreground/34">State</span>
              <p className="mt-1 text-[0.82rem] text-sidebar-foreground/58">{syncStateMeta}</p>
            </div>
            <div className="min-w-0">
              <span className="uppercase tracking-[0.16em] text-sidebar-foreground/34">Updated</span>
              <p className="mt-1 break-words text-[0.82rem] text-sidebar-foreground/58">
                {lastSyncedAtLabel ?? "Not available"}
              </p>
            </div>
          </div>
        </div>
        <div>
          <SidebarGroupLabel className="mb-1.5 px-1">Workspace</SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {items.map((item) => {
              const content = (
                <>
                  {item.icon ? <item.icon className="size-4 text-sidebar-foreground/68" /> : null}
                  <span className="truncate">{item.title}</span>
                  {item.badge ? (
                    <span className="ml-auto min-w-10 text-right text-[0.74rem] font-medium tabular-nums text-sidebar-foreground/44 transition-colors duration-150 group-data-[active=true]/nav-item:text-sidebar-foreground/62">
                      {item.badge}
                    </span>
                  ) : null}
                </>
              );

              const navClassName =
                "group/nav-item h-9 px-2.5 text-[0.92rem] font-medium text-sidebar-foreground/78 before:absolute before:top-1/2 before:left-2.5 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary/0 before:opacity-0 before:transition-all before:duration-150 after:absolute after:inset-0 after:rounded-[1rem] after:bg-[radial-gradient(circle_at_24%_50%,rgba(88,255,170,0.12),transparent_34%)] after:opacity-0 after:transition-opacity after:duration-150 after:content-[''] data-[active=true]:pl-4 data-[active=true]:text-sidebar-foreground data-[active=true]:before:opacity-100 data-[active=true]:before:bg-primary data-[active=true]:after:opacity-100";

              return (
                <SidebarMenuItem key={item.title}>
                  {item.url ? (
                    item.url.startsWith("/") &&
                    !item.external &&
                    !item.url.includes("?") &&
                    !item.url.includes("#") ? (
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={item.isActive}
                        className={navClassName}
                      >
                        <Link to={item.url}>{content}</Link>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        isActive={item.isActive}
                        className={navClassName}
                      >
                        <a
                          href={item.url}
                          target={item.external ? "_blank" : undefined}
                          rel={item.external ? "noreferrer" : undefined}
                        >
                          {content}
                        </a>
                      </SidebarMenuButton>
                    )
                  ) : (
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={item.isActive}
                      className={navClassName}
                      onClick={item.onClick}
                    >
                      {content}
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};
