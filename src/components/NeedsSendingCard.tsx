import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, FileText, ExternalLink } from "lucide-react";
import { SendDocumentEmailDialog } from "@/components/SendDocumentEmailDialog";
import { useAuth } from "@/hooks/useAuth";
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface UnsentInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string | null;
  total_amount: number;
  status: string;
}

interface NeedsSendingCardProps {
  invoices: UnsentInvoice[];
  formatCurrency: (amount: number) => string;
  onSent?: () => void;
}

export function NeedsSendingCard({
  invoices,
  formatCurrency,
  onSent,
}: NeedsSendingCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings: companySettings } = useCompanySettings();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<UnsentInvoice | null>(null);

  const handleSendClick = (invoice: UnsentInvoice) => {
    setSelectedInvoice(invoice);
    setSendDialogOpen(true);
  };

  const handleSendSuccess = () => {
    setSendDialogOpen(false);
    setSelectedInvoice(null);
    onSent?.();
  };

  const handleViewAll = () => {
    navigate("/invoices?needsSending=true");
  };

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Needs Sending
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={handleViewAll}
            >
              View all
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          {invoices.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">All invoices have been sent!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.slice(0, 5).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                        className="font-medium text-sm hover:text-primary transition-colors truncate"
                      >
                        {invoice.invoice_number}
                      </button>
                      <Badge
                        variant={invoice.status === "draft" ? "secondary" : "outline"}
                        className="text-xs shrink-0"
                      >
                        {invoice.status === "draft" ? "Draft" : "Not sent"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {invoice.customer_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">
                      {formatCurrency(invoice.total_amount)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      onClick={() => handleSendClick(invoice)}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Send
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedInvoice && user && (
        <SendDocumentEmailDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          documentType="invoice"
          documentId={selectedInvoice.id}
          documentNumber={selectedInvoice.invoice_number}
          customer={{
            id: selectedInvoice.customer_id,
            name: selectedInvoice.customer_name,
            email: selectedInvoice.customer_email,
          }}
          companyName={companySettings?.company_name || ""}
          userId={user.id}
          onSuccess={handleSendSuccess}
        />
      )}
    </>
  );
}
