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
  Mail,
  FileCheck,
  LogOut,
  Package,
  FileSpreadsheet,
  Search,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { CommandPalette } from "@/components/CommandPalette";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { useReminderCount } from "@/hooks/useReminderCount";

const navigationGroups = [
  {
    label: null,
    items: [
      { name: "Dashboard", href: "/", icon: BarChart3 },
    ],
  },
  {
    label: "Documents",
    items: [
      { name: "Invoices", href: "/invoices", icon: FileText },
      { name: "Quotations", href: "/quotations", icon: FileCheck },
      { name: "Credit Notes", href: "/credit-notes", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Clients",
    items: [
      { name: "Customers", href: "/customers", icon: Users },
      { name: "Services", href: "/services", icon: Package },
    ],
  },
  {
    label: "Finance",
    items: [
      { name: "Reports", href: "/reports", icon: BarChart3 },
      { name: "Payments", href: "/payments", icon: CreditCard },
      { name: "Reminders", href: "/reminders", icon: Mail },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Data", href: "/data", icon: Database },
      { name: "Templates", href: "/invoice-templates", icon: FileText },
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const { count: reminderCount } = useReminderCount();

  return (
    <>
      {/* Global Command Palette */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Mobile menu button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="icon" onClick={() => setIsOpen(!isOpen)} className="bg-background">
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {isOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />}

      {/* Navigation sidebar */}
      <nav
        className={cn(
          "fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-40 transform transition-transform duration-200 ease-in-out flex flex-col",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
              <Euro className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-sidebar-primary-foreground tracking-tight">
                Invoice<span className="font-bold">Pro</span>
              </h1>
              <p className="text-[11px] text-sidebar-foreground/60">Malta Receivables</p>
            </div>
          </div>
        </div>

        {/* ⌘K Search trigger */}
        <div className="px-4 py-3 border-b border-sidebar-border">
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors group"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left text-xs">Search…</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground transition-colors">
              {/Mac|iPhone|iPad/i.test(navigator.platform) ? <><span className="text-[10px]">⌘</span>K</> : "Ctrl K"}
            </kbd>
          </button>
        </div>

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-3 px-3 space-y-4">
          {navigationGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isReminders = item.href === "/reminders";
                  const showBadge = isReminders && reminderCount > 0;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      end={item.href === "/"}
                      onClick={() => setIsOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-white/50 pl-[10px]"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.name}</span>
                      {showBadge && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none">
                          {reminderCount > 99 ? "99+" : reminderCount}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User info and sign out */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-3 px-3 py-2">
            <p className="text-[11px] text-sidebar-foreground/50">Signed in as</p>
            <p className="text-sm font-medium truncate text-sidebar-foreground">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full flex items-center space-x-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
          <div className="mt-2 px-3">
            <a
              href="mailto:support@invoicepro.mt"
              className="text-[11px] text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
            >
              Need help?
            </a>
          </div>
        </div>
      </nav>
    </>
  );
}
