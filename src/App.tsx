
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Invoices from "./pages/Invoices";
import InvoiceDetails from "./pages/InvoiceDetails";
import ServiceLibrary from "./pages/ServiceLibrary";
import Quotations from "./pages/Quotations";
import Customers from "./pages/Customers";
import Reports from "./pages/Reports";
import ReminderSettings from "./pages/ReminderSettings";
import InvoiceTemplates from "./pages/InvoiceTemplates";
import Settings from "./pages/Settings";
import NewInvoice from "./pages/NewInvoice";
import NewQuotation from "./pages/NewQuotation";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ExportInvoices from "./pages/ExportInvoices";
import ImportInvoices from "./pages/ImportInvoices";
import ExportCustomers from "./pages/ExportCustomers";
import ImportCustomers from "./pages/ImportCustomers";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import CreditNotes from "./pages/CreditNotes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="/invoices/new" element={<ProtectedRoute><NewInvoice /></ProtectedRoute>} />
            <Route path="/invoices/edit/:id" element={<ProtectedRoute><NewInvoice /></ProtectedRoute>} />
            <Route path="/invoices/export" element={<ProtectedRoute><ExportInvoices /></ProtectedRoute>} />
            <Route path="/invoices/import" element={<ProtectedRoute><ImportInvoices /></ProtectedRoute>} />
            <Route path="/invoices/:invoice_id" element={<ProtectedRoute><InvoiceDetails /></ProtectedRoute>} />
            <Route path="/quotations" element={<ProtectedRoute><Quotations /></ProtectedRoute>} />
            <Route path="/quotations/new" element={<ProtectedRoute><NewQuotation /></ProtectedRoute>} />
            <Route path="/quotations/edit/:id" element={<ProtectedRoute><NewQuotation /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/customers/export" element={<ProtectedRoute><ExportCustomers /></ProtectedRoute>} />
            <Route path="/customers/import" element={<ProtectedRoute><ImportCustomers /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/reminders" element={<ProtectedRoute><ReminderSettings /></ProtectedRoute>} />
            <Route path="/invoice-templates" element={<ProtectedRoute><InvoiceTemplates /></ProtectedRoute>} />
            <Route path="/services" element={<ProtectedRoute><ServiceLibrary /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/credit-notes" element={<ProtectedRoute><CreditNotes /></ProtectedRoute>} />
            <Route path="/credit-notes/:id" element={<ProtectedRoute><CreditNotes /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
