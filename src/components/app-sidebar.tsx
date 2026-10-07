import * as React from "react";
import {
  IconActivityHeartbeat,
  IconArrowUpRight,
  IconBolt,
  IconChartBar,
  IconDatabase,
  IconHelp,
  IconLayoutDashboard,
  IconMessageCircle,
  IconRefresh,
  IconTrash,
  type Icon,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import logoSrc from "../../public/logo.webp";
import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export type SidebarNavItem = {
  title: string;
  icon: Icon;
  url?: string;
  onClick?: () => void;
  isActive?: boolean;
  badge?: string;
  external?: boolean;
};

export type SidebarResourceItem = {
  name: string;
  icon: Icon;
  value: string;
  hint?: string;
  gaugeValue?: number;
};

export type SidebarUser = {
  name: string;
  email: string;
  avatar?: string;
};

export type SidebarAction = {
  label: string;
  icon: Icon;
  onClick?: () => void;
  href?: string;
  external?: boolean;
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  mainItems?: SidebarNavItem[];
  secondaryItems?: SidebarNavItem[];
  resources?: SidebarResourceItem[];
  user?: SidebarUser;
  primaryAction?: SidebarAction;
  utilityAction?: SidebarAction;
  resourcesLabel?: string;
  onSignOut?: () => void;
  syncStatusLabel?: string;
  syncDetailLabel?: string;
  lastSyncedAtLabel?: string;
};

const defaultMainItems: SidebarNavItem[] = [
  {
    title: "Overview",
    icon: IconLayoutDashboard,
    badge: "Live",
    isActive: true,
  },
  {
    title: "Sentiment",
    icon: IconChartBar,
    badge: "AI",
  },
  {
    title: "Explorer",
    icon: IconDatabase,
  },
];

const defaultSecondaryItems: SidebarNavItem[] = [
  {
    title: "Sync activity",
    icon: IconArrowUpRight,
    url: "/admin/sync",
    external: true,
  },
  {
    title: "Data reset",
    icon: IconTrash,
  },
  {
    title: "Support",
    icon: IconHelp,
    url: "mailto:ops@rootlabs.co",
    external: true,
  },
];

const defaultResources: SidebarResourceItem[] = [
  {
    name: "Sync monitor",
    icon: IconActivityHeartbeat,
    value: "Activity log",
    hint: "Inspect recent sync runs and failures.",
  },
  {
    name: "Sync cadence",
    icon: IconRefresh,
    value: "Manual",
    hint: "Trigger re-ingest after major Discord changes.",
  },
];

const defaultUser: SidebarUser = {
  name: "Root Labs Admin",
  email: "admin@rootlabs.co",
};

export const AppSidebar = ({
  mainItems = defaultMainItems,
  secondaryItems = defaultSecondaryItems,
  resources = defaultResources,
  user = defaultUser,
  primaryAction = {
    label: "Run sync",
    icon: IconBolt,
  },
  utilityAction = {
    label: "Open chat",
    icon: IconMessageCircle,
  },
  resourcesLabel = "Signals",
  onSignOut,
  syncStatusLabel,
  syncDetailLabel,
  lastSyncedAtLabel,
  ...props
}: AppSidebarProps) => {
  return (
    <Sidebar collapsible="offcanvas" variant="inset" {...props}>
      {/* Keep the brand light so the navigation carries the hierarchy. */}
      <SidebarHeader className="border-b border-sidebar-border/70 px-4 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-auto rounded-none border-0 bg-transparent p-0 shadow-none hover:bg-transparent data-[slot=sidebar-menu-button]:h-auto data-[slot=sidebar-menu-button]:p-0"
            >
              <Link to="/dashboard" className="flex items-center">
                <img
                  src={logoSrc}
                  alt="Root Labs"
                  className="h-7 w-auto shrink-0 object-contain"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="pt-2">
        <NavMain
          items={mainItems}
          primaryAction={primaryAction}
          utilityAction={utilityAction}
          syncStatusLabel={syncStatusLabel}
          syncDetailLabel={syncDetailLabel}
          lastSyncedAtLabel={lastSyncedAtLabel}
        />
        <NavDocuments items={resources} label={resourcesLabel} />
        <NavSecondary items={secondaryItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/70 pt-3">
        <NavUser user={user} onSignOut={onSignOut} />
      </SidebarFooter>
    </Sidebar>
  );
};
