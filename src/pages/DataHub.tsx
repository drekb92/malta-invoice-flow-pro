import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Upload, Download, FileText, Users } from "lucide-react";

interface ActionCard {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  variant: "import" | "export";
}

const invoiceActions: ActionCard[] = [
  {
    icon: Upload,
    label: "Import Invoices",
    description: "Upload a CSV to bulk-create or update invoices",
    href: "/imports/invoices",
    variant: "import",
  },
  {
    icon: Download,
    label: "Export Invoices",
    description: "Download invoices as CSV with date, status, and client filters",
    href: "/exports/invoices",
    variant: "export",
  },
];

const customerActions: ActionCard[] = [
  {
    icon: Upload,
    label: "Import Customers",
    description: "Upload a CSV to bulk-create or update customer records",
    href: "/imports/customers",
    variant: "import",
  },
  {
    icon: Download,
    label: "Export Customers",
    description: "Download your customer list as CSV with VAT and type filters",
    href: "/exports/customers",
    variant: "export",
  },
];

function Card({ action }: { action: ActionCard }) {
  const navigate = useNavigate();
  const isImport = action.variant === "import";

  return (
    <button
      onClick={() => navigate(action.href)}
      className="group w-full text-left rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            isImport
              ? "bg-blue-50 text-blue-600"
              : "bg-emerald-50 text-emerald-600"
          }`}
        >
          <action.icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground group-hover:text-primary transition-colors">
            {action.label}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground leading-snug">
            {action.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  actions,
}: {
  icon: React.ElementType;
  title: string;
  actions: ActionCard[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {actions.map((a) => (
          <Card key={a.href} action={a} />
        ))}
      </div>
    </div>
  );
}

const DataHub = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="md:pl-64">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Data</h1>
            <p className="mt-1 text-muted-foreground">
              Import or export invoices and customers via CSV
            </p>
          </div>

          <div className="space-y-8">
            <Section icon={FileText} title="Invoices" actions={invoiceActions} />
            <Section icon={Users} title="Customers" actions={customerActions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataHub;
