import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, FileText, Receipt, Users } from "lucide-react";

export function DashboardFAB() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const actions = [
    {
      label: "New Invoice",
      icon: FileText,
      onClick: () => navigate("/invoices/new"),
    },
    {
      label: "New Quotation",
      icon: Receipt,
      onClick: () => navigate("/quotations/new"),
    },
    {
      label: "New Customer",
      icon: Users,
      onClick: () => navigate("/customers?action=new"),
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 md:hidden">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className={`h-6 w-6 transition-transform ${open ? "rotate-45" : ""}`} />
            <span className="sr-only">Create new</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 mb-2">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              onClick={() => {
                action.onClick();
                setOpen(false);
              }}
              className="cursor-pointer"
            >
              <action.icon className="h-4 w-4 mr-2" />
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
