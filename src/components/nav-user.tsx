import { IconLogout } from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavUserProps = {
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
  onSignOut?: () => void;
};

const getInitials = (name: string): string => {
  const parts = name
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((value) => value[0]?.toUpperCase() ?? "").join("") || "RL";
};

export const NavUser = ({ user, onSignOut }: NavUserProps) => {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="rounded-[1rem] border border-sidebar-border/70 bg-white/[0.025] px-2.5 transition-[background-color,border-color,color] duration-150 hover:border-sidebar-border hover:bg-white/[0.045] data-[state=open]:border-sidebar-border data-[state=open]:bg-white/[0.05] data-[state=open]:text-sidebar-foreground"
            >
              <Avatar className="h-7 w-7 rounded-[0.8rem] border border-sidebar-border/70">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-[0.8rem] bg-sidebar-primary text-sidebar-primary-foreground">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[0.86rem] font-medium">{user.name}</span>
                <span className="truncate text-[0.72rem] text-sidebar-foreground/56">
                  {user.email}
                </span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuLabel className="grid gap-1 px-3 py-2">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}>
              <IconLogout />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
