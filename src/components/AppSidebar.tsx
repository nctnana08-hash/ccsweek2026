import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, ScanLine, ListChecks, UserX, FileSpreadsheet, KeyRound, Lock, Unlock, QrCode,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { CcsLogo } from "@/components/CcsLogo";
import { useAdmin } from "@/stores/admin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Events", url: "/events", icon: CalendarDays },
  { title: "Students", url: "/students", icon: Users },
  { title: "Records", url: "/records", icon: ListChecks },
  { title: "Absences", url: "/absences", icon: UserX },
  { title: "IPC Export", url: "/ipc", icon: FileSpreadsheet },
  { title: "PIN Settings", url: "/pins", icon: KeyRound },
];
const officerItems = [
  { title: "Attendance Scanner", url: "/attendance", icon: ScanLine },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { unlocked, lock } = useAdmin();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 w-full rounded-md px-2 py-2 text-sm transition-colors",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
        : "hover:bg-sidebar-accent/50 text-sidebar-foreground",
    );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <CcsLogo size={36} />
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display uppercase text-sm tracking-wide text-sidebar-primary truncate">CCS</div>
              <div className="text-[10px] text-muted-foreground truncate">Student Council</div>
            </div>
          )}
        </div>
        <div className="ccs-bunting" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Officer</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {officerItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={linkClass(isActive(item.url))}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/get-qr" target="_blank" className={linkClass(false)}>
                    <QrCode className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Public Get-QR ↗</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {unlocked && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={linkClass(isActive(item.url))}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {unlocked ? (
          <Button variant="ghost" size="sm" onClick={lock} className="w-full justify-start gap-2">
            <Unlock className="h-4 w-4 text-flag-green" />
            {!collapsed && <span className="text-xs">Admin Active · Tap to Lock</span>}
          </Button>
        ) : (
          <div className={cn("flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground", collapsed && "justify-center")}>
            <Lock className="h-3.5 w-3.5" />
            {!collapsed && <span>Officer view</span>}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
