import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Submission from "./pages/Submission.tsx";
import Admin from "./pages/Admin.tsx";
import ChamadaForm from "./pages/admin/ChamadaForm.tsx";
import CallResponse from "./pages/CallResponse.tsx";
import SubmissionInterna from "./pages/SubmissionInterna.tsx";
import SubmissionEditais from "./pages/SubmissionEditais.tsx";
import DashboardFounder from "./pages/DashboardFounder.tsx";
import DashboardColaborador from "./pages/DashboardColaborador.tsx";
import AccessDenied from "./pages/AccessDenied.tsx";
import Chamadas from "./pages/Chamadas.tsx";
import NotFound from "./pages/NotFound.tsx";
import IniciativaDetalhe from "./pages/IniciativaDetalhe.tsx";
import DashboardViewer from "./pages/DashboardViewer.tsx";
import OngoingPublico from "./pages/OngoingPublico.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/acesso-negado" element={<AccessDenied />} />
            <Route path="/chamadas" element={<Chamadas />} />
            <Route path="/dashboard-founder" element={<ProtectedRoute allowedRoles={["founder", "admin"]}><DashboardFounder /></ProtectedRoute>} />
            <Route path="/dashboard-colaborador" element={<ProtectedRoute allowedRoles={["colaborador", "admin"]}><DashboardColaborador /></ProtectedRoute>} />
            <Route path="/submissaomercado" element={<ProtectedRoute allowedRoles={["founder", "admin"]}><Submission /></ProtectedRoute>} />
            <Route path="/submissaointerna" element={<ProtectedRoute allowedRoles={["colaborador", "admin"]}><SubmissionInterna /></ProtectedRoute>} />
            <Route path="/submissaoeditais" element={<ProtectedRoute allowedRoles={["colaborador", "admin"]}><SubmissionEditais /></ProtectedRoute>} />
            <Route path="/dashboard-viewer" element={<ProtectedRoute allowedRoles={["viewer", "admin"]}><DashboardViewer /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><Admin /></ProtectedRoute>} />
            <Route path="/admin/chamadas/nova" element={<ProtectedRoute allowedRoles={["admin"]}><ChamadaForm /></ProtectedRoute>} />
            <Route path="/admin/chamadas/:id/editar" element={<ProtectedRoute allowedRoles={["admin"]}><ChamadaForm /></ProtectedRoute>} />
            <Route path="/iniciativa/:id" element={<ProtectedRoute allowedRoles={["admin", "colaborador"]}><IniciativaDetalhe /></ProtectedRoute>} />
            <Route path="/chamadas/:id" element={<CallResponse />} />
            {/* Pública (sem login): acompanhamento Ongoing via token revogável */}
            <Route path="/ongoing/:token" element={<OngoingPublico />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
