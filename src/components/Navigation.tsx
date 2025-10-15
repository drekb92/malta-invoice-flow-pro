
import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  FileText,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Menu,
  X,
  Euro,
  Receipt,
  Mail,
  Calendar,
  FileCheck,
  LogOut,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const navigationItems = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Quotations", href: "/quotations", icon: FileCheck },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Services", href: "/services", icon: Package },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Reminders", href: "/reminders", icon: Mail },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Templates", href: "/invoice-templates", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();

  return (
    <>
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-background"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Navigation sidebar */}
      <nav
        className={cn(
          "fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-40 transform transition-transform duration-200 ease-in-out flex flex-col",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Euro className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">InvoicePro</h1>
              <p className="text-xs text-muted-foreground">Malta Receivables</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-2 flex-1">
          {navigationItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </div>

        {/* User info and sign out */}
        <div className="p-4 border-t border-border">
          <div className="mb-3 px-3 py-2">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium truncate">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            className="w-full flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
        </div>
      </nav>
    </>
  );
}
