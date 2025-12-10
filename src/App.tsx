import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import Invoices from "./pages/Invoices";
import InvoiceDetails from "./pages/InvoiceDetails";
import ServiceLibrary from "./pages/ServiceLibrary";
import Quotations from "./pages/Quotations";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
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

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Auth & recovery */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Onboarding (protected, but special) */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />

              {/* Main dashboard */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />

              {/* Invoices */}
              <Route
                path="/invoices"
                element={
                  <ProtectedRoute>
                    <Invoices />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices/new"
                element={
                  <ProtectedRoute>
                    <NewInvoice />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices/edit/:id"
                element={
                  <ProtectedRoute>
                    <NewInvoice />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices/:id"
                element={
                  <ProtectedRoute>
                    <InvoiceDetails />
                  </ProtectedRoute>
                }
              />

              {/* Credit notes */}
              <Route
                path="/credit-notes"
                element={
                  <ProtectedRoute>
                    <CreditNotes />
                  </ProtectedRoute>
                }
              />

              {/* Services */}
              <Route
                path="/services"
                element={
                  <ProtectedRoute>
                    <ServiceLibrary />
                  </ProtectedRoute>
                }
              />

              {/* Quotations */}
              <Route
                path="/quotations"
                element={
                  <ProtectedRoute>
                    <Quotations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quotations/new"
                element={
                  <ProtectedRoute>
                    <NewQuotation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quotations/:id/edit"
                element={
                  <ProtectedRoute>
                    <NewQuotation />
                  </ProtectedRoute>
                }
              />

              {/* Customers */}
              <Route
                path="/customers"
                element={
                  <ProtectedRoute>
                    <Customers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customers/:id"
                element={
                  <ProtectedRoute>
                    <CustomerDetail />
                  </ProtectedRoute>
                }
              />

              {/* Reports */}
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <Reports />
                  </ProtectedRoute>
                }
              />

              {/* Reminders */}
              <Route
                path="/reminders"
                element={
                  <ProtectedRoute>
                    <ReminderSettings />
                  </ProtectedRoute>
                }
              />

              {/* Templates */}
              <Route
                path="/templates"
                element={
                  <ProtectedRoute>
                    <InvoiceTemplates />
                  </ProtectedRoute>
                }
              />

              {/* Settings */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />

              {/* Import / Export */}
              <Route
                path="/exports/invoices"
                element={
                  <ProtectedRoute>
                    <ExportInvoices />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/imports/invoices"
                element={
                  <ProtectedRoute>
                    <ImportInvoices />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/exports/customers"
                element={
                  <ProtectedRoute>
                    <ExportCustomers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/imports/customers"
                element={
                  <ProtectedRoute>
                    <ImportCustomers />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>

      {/* Global toasters */}
      <Toaster />
      <Sonner />
    </QueryClientProvider>
  );
};

export default App;
