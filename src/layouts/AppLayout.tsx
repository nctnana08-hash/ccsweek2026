import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAdmin } from "@/stores/admin";
import { PinDialog } from "@/components/PinDialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

const ADMIN_ROUTES = ["/", "/events", "/students", "/records", "/absences", "/ipc", "/pins"];

export default function AppLayout() {
  const { unlocked, hydrate } = useAdmin();
  const [pinOpen, setPinOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { hydrate(); }, [hydrate]);

  const isAdminRoute = ADMIN_ROUTES.some(
    (r) => location.pathname === r || (r !== "/" && location.pathname.startsWith(r + "/")),
  ) || location.pathname.startsWith("/events/");

  useEffect(() => {
    if (isAdminRoute && !unlocked) {
      navigate("/attendance", { replace: true });
    }
  }, [isAdminRoute, unlocked, navigate]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background ccs-circuit-bg">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 border-b border-border bg-card/80 backdrop-blur flex items-center px-2 gap-2 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex-1" />
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>

        {!unlocked && (
          <Button
            onClick={() => setPinOpen(true)}
            size="lg"
            className="fixed bottom-4 right-4 rounded-full h-14 w-14 p-0 shadow-festive bg-gradient-primary z-40"
            aria-label="Admin unlock"
          >
            <Lock className="h-5 w-5" />
          </Button>
        )}

        <PinDialog
          open={pinOpen}
          onOpenChange={setPinOpen}
          scope="admin"
          title="Admin Unlock"
          description="Enter the Admin PIN to access management features."
          onSuccess={(token) => {
            if (token) useAdmin.getState().unlock(token);
          }}
        />
      </div>
    </SidebarProvider>
  );
}
