import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import Attendance from "./pages/Attendance";
import Records from "./pages/Records";
import Absences from "./pages/Absences";
import IpcExport from "./pages/IpcExport";
import PinSettings from "./pages/PinSettings";
import OfficerView from "./pages/OfficerView";
import GetQr from "./pages/GetQr";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          {/* Public routes (no shell) */}
          <Route path="/get-qr" element={<GetQr />} />

          {/* App shell */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/students" element={<Students />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/records" element={<Records />} />
            <Route path="/absences" element={<Absences />} />
            <Route path="/officer-view" element={<OfficerView />} />
            <Route path="/ipc" element={<IpcExport />} />
            <Route path="/pins" element={<PinSettings />} />
          </Route>

          <Route path="/index" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
