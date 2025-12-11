import { useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, Download, Eye, Mail, MessageCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface StatementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
}

export const StatementModal = ({ open, onOpenChange, customer }: StatementModalProps) => {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(subMonths(new Date(), 3)));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [statementType, setStatementType] = useState<"outstanding" | "activity">("outstanding");
  const [includeCreditNotes, setIncludeCreditNotes] = useState(true);
  const [includeVatBreakdown, setIncludeVatBreakdown] = useState(true);

  const handlePreviewPDF = () => {
    toast({
      title: "Preview Statement",
      description: "PDF preview will open in a new tab.",
    });
    // TODO: Implement PDF preview
  };

  const handleDownload = () => {
    toast({
      title: "Downloading Statement",
      description: `Statement for ${customer.name} is being generated.`,
    });
    // TODO: Implement PDF download
  };

  const handleSendEmail = () => {
    if (!customer.email) {
      toast({
        title: "No email address",
        description: "This customer doesn't have an email address on file.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Sending Statement",
      description: `Statement will be sent to ${customer.email}`,
    });
    // TODO: Implement email sending
  };

  const handleSendWhatsApp = () => {
    toast({
      title: "WhatsApp",
      description: "Opening WhatsApp to send statement.",
    });
    // TODO: Implement WhatsApp sharing
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Issue Statement
          </DialogTitle>
          <DialogDescription>
            Generate a statement for {customer.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Date Range</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => date && setDateFrom(date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => date && setDateTo(date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <Separator />

          {/* Statement Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Statement Type</Label>
            <RadioGroup
              value={statementType}
              onValueChange={(value) => setStatementType(value as "outstanding" | "activity")}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="outstanding" id="outstanding" />
                <div className="flex-1">
                  <Label htmlFor="outstanding" className="cursor-pointer font-medium">
                    Outstanding Only
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Shows only unpaid invoices and balances
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="activity" id="activity" />
                <div className="flex-1">
                  <Label htmlFor="activity" className="cursor-pointer font-medium">
                    Activity Statement
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Full ledger including all invoices and payments
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Options */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Options</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="credit-notes" className="text-sm">Include Credit Notes</Label>
                  <p className="text-xs text-muted-foreground">Show credit notes in the statement</p>
                </div>
                <Switch
                  id="credit-notes"
                  checked={includeCreditNotes}
                  onCheckedChange={setIncludeCreditNotes}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="vat-breakdown" className="text-sm">Include VAT Breakdown</Label>
                  <p className="text-xs text-muted-foreground">Show VAT details for each item</p>
                </div>
                <Switch
                  id="vat-breakdown"
                  checked={includeVatBreakdown}
                  onCheckedChange={setIncludeVatBreakdown}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={handlePreviewPDF} className="w-full">
                <Eye className="h-4 w-4 mr-2" />
                Preview PDF
              </Button>
              <Button variant="outline" onClick={handleDownload} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleSendEmail} className="w-full">
                <Mail className="h-4 w-4 mr-2" />
                Send via Email
              </Button>
              <Button variant="secondary" onClick={handleSendWhatsApp} className="w-full">
                <MessageCircle className="h-4 w-4 mr-2" />
                Send via WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
