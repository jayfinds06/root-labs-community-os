import { type Icon } from "@tabler/icons-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavDocumentsItem = {
  name: string;
  icon: Icon;
  value: string;
  hint?: string;
  gaugeValue?: number;
};

type NavDocumentsProps = {
  items: NavDocumentsItem[];
  label?: string;
};

export const NavDocuments = ({ items, label = "Documents" }: NavDocumentsProps) => {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden border-t border-sidebar-border/70 px-2 pt-3">
      <SidebarGroupLabel className="mb-1.5 px-1">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-2">
          {items.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton className="ui-tonal-panel h-auto min-h-0 rounded-[1rem] px-3 py-2.5 text-sidebar-foreground/80 transition-all duration-150 hover:border-sidebar-border/80 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[0.85rem] border border-white/6 bg-white/[0.025]">
                  <item.icon className="size-4 shrink-0 text-sidebar-foreground/66" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.88rem] font-medium text-sidebar-foreground">
                        {item.name}
                      </p>
                      {item.hint ? (
                        <p className="mt-0.5 line-clamp-2 text-[0.72rem] leading-[1.1rem] text-sidebar-foreground/46">
                          {item.hint}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 pt-0.5 text-right">
                      <p className="text-[0.95rem] font-semibold tracking-[-0.02em] text-sidebar-foreground">
                        {item.value}
                      </p>
                    </div>
                  </div>
                  {typeof item.gaugeValue === "number" ? (
                    <div className="mt-2.5">
                      <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,rgba(248,113,113,0.92),rgba(250,204,21,0.96),rgba(74,222,128,0.96))] shadow-[0_0_14px_rgba(88,255,170,0.14)]"
                          style={{ width: `${Math.max(6, Math.min(100, item.gaugeValue))}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[0.58rem] uppercase tracking-[0.14em] text-sidebar-foreground/42">
                        <span>Low</span>
                        <span>Balanced</span>
                        <span>High</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};
