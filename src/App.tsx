import React from "react";
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AiChatPanel from "@/components/AiChatPanel";

import Index from "./pages/Index";
import Invoices from "./pages/Invoices";
import InvoiceDetails from "./pages/InvoiceDetails";
import ServiceLibrary from "./pages/ServiceLibrary";
import Quotations from "./pages/Quotations";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import EditCustomer from "./pages/EditCustomer";
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
import DataHub from "./pages/DataHub";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import CreditNotes from "./pages/CreditNotes";
import Redirect from "./pages/Redirect";
import ActivityLog from "./pages/ActivityLog";
import PublicInvoiceView from "./pages/PublicInvoiceView";
import RecurringInvoices from "./pages/RecurringInvoices";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const RootLayout = () => (
  <AuthProvider>
    <Outlet />
    <AiChatPanel />
  </AuthProvider>
);

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/auth", element: <Auth /> },
      { path: "/reset-password", element: <ResetPassword /> },
      { path: "/redirect", element: <Redirect /> },
      { path: "/view/:token", element: <PublicInvoiceView /> },

      { path: "/onboarding", element: <ProtectedRoute><Onboarding /></ProtectedRoute> },
      { path: "/", element: <ProtectedRoute><Index /></ProtectedRoute> },
      { path: "/activity", element: <ProtectedRoute><ActivityLog /></ProtectedRoute> },

      { path: "/invoices", element: <ProtectedRoute><Invoices /></ProtectedRoute> },
      { path: "/invoices/new", element: <ProtectedRoute><NewInvoice /></ProtectedRoute> },
      { path: "/invoices/edit/:id", element: <ProtectedRoute><NewInvoice /></ProtectedRoute> },
      { path: "/invoices/:id", element: <ProtectedRoute><InvoiceDetails /></ProtectedRoute> },

      { path: "/credit-notes", element: <ProtectedRoute><CreditNotes /></ProtectedRoute> },
      { path: "/services", element: <ProtectedRoute><ServiceLibrary /></ProtectedRoute> },

      { path: "/quotations", element: <ProtectedRoute><Quotations /></ProtectedRoute> },
      { path: "/quotations/new", element: <ProtectedRoute><NewQuotation /></ProtectedRoute> },
      { path: "/quotations/:id/edit", element: <ProtectedRoute><NewQuotation /></ProtectedRoute> },

      { path: "/customers", element: <ProtectedRoute><Customers /></ProtectedRoute> },
      { path: "/customers/:id", element: <ProtectedRoute><CustomerDetail /></ProtectedRoute> },
      { path: "/customers/edit/:id", element: <ProtectedRoute><EditCustomer /></ProtectedRoute> },

      { path: "/reports", element: <ProtectedRoute><Reports /></ProtectedRoute> },
      { path: "/reminders", element: <ProtectedRoute><ReminderSettings /></ProtectedRoute> },
      { path: "/recurring-invoices", element: <ProtectedRoute><RecurringInvoices /></ProtectedRoute> },
      { path: "/templates", element: <ProtectedRoute><InvoiceTemplates /></ProtectedRoute> },
      { path: "/invoice-templates", element: <ProtectedRoute><InvoiceTemplates /></ProtectedRoute> },
      { path: "/settings", element: <ProtectedRoute><Settings /></ProtectedRoute> },
      { path: "/data", element: <ProtectedRoute><DataHub /></ProtectedRoute> },

      { path: "/exports/invoices", element: <ProtectedRoute><ExportInvoices /></ProtectedRoute> },
      { path: "/imports/invoices", element: <ProtectedRoute><ImportInvoices /></ProtectedRoute> },
      { path: "/exports/customers", element: <ProtectedRoute><ExportCustomers /></ProtectedRoute> },
      { path: "/imports/customers", element: <ProtectedRoute><ImportCustomers /></ProtectedRoute> },

      { path: "*", element: <NotFound /> },
    ],
  },
]);

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
