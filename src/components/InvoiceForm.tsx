import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { Plus, Edit, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  payment_terms: string | null;
}

interface Invoice {
  id?: string;
  invoice_number: string;
  customer_id: string;
  amount: number;
  vat_rate: number;
  due_date: string;
  status: string;
}

interface InvoiceFormProps {
  invoice?: Invoice;
  onSave: () => void;
  trigger?: React.ReactNode;
}

export function InvoiceForm({ invoice, onSave, trigger }: InvoiceFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    invoice_number: invoice?.invoice_number || "",
    customer_id: invoice?.customer_id || "",
    amount: invoice?.amount || 0,
    vat_rate: invoice?.vat_rate || 0.18,
    due_date: invoice ? new Date(invoice.due_date) : undefined as Date | undefined,
    status: invoice?.status || "draft",
  });

  // Calculate totals
  const netAmount = formData.amount;
  const vatAmount = netAmount * formData.vat_rate;
  const totalAmount = netAmount + vatAmount;

  // Fetch customers for dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, payment_terms")
        .order("name");
      
      if (error) {
        console.error("Error fetching customers:", error);
        return;
      }
      
      setCustomers(data || []);
    };

    if (open) {
      fetchCustomers();
    }
  }, [open]);

  // Auto-generate invoice number for new invoices
  useEffect(() => {
    if (!invoice?.id && open && !formData.invoice_number) {
      const generateInvoiceNumber = async () => {
        const { data, error } = await supabase
          .from("invoices")
          .select("invoice_number")
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error("Error fetching last invoice:", error);
          return;
        }

        let nextNumber = 1;
        if (data && data.length > 0) {
          const lastNumber = data[0].invoice_number;
          const match = lastNumber.match(/INV-(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1]) + 1;
          }
        }

        const invoiceNumber = `INV-${String(nextNumber).padStart(6, '0')}`;
        setFormData(prev => ({ ...prev, invoice_number: invoiceNumber }));
      };

      generateInvoiceNumber();
    }
  }, [open, invoice?.id, formData.invoice_number]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.due_date) {
        throw new Error("Due date is required");
      }

      const invoiceData = {
        invoice_number: formData.invoice_number,
        customer_id: formData.customer_id,
        amount: netAmount,
        vat_rate: formData.vat_rate,
        due_date: formData.due_date.toISOString().split('T')[0],
        status: formData.status,
      };

      if (invoice?.id) {
        // Update existing invoice
        const { error } = await supabase
          .from("invoices")
          .update(invoiceData)
          .eq("id", invoice.id);

        if (error) throw error;
        
        toast({
          title: "Invoice updated",
          description: "Invoice has been successfully updated.",
        });
      } else {
        // Create new invoice
        const { error } = await supabase
          .from("invoices")
          .insert([invoiceData]);

        if (error) throw error;
        
        toast({
          title: "Invoice created",
          description: "New invoice has been successfully created.",
        });
      }

      setOpen(false);
      onSave();
      
      // Reset form if creating new invoice
      if (!invoice?.id) {
        setFormData({
          invoice_number: "",
          customer_id: "",
          amount: 0,
          vat_rate: 0.18,
          due_date: undefined,
          status: "draft",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = invoice?.id ? (
    <Button variant="ghost" size="sm">
      <Edit className="h-4 w-4" />
    </Button>
  ) : (
    <Button size="sm">
      <Plus className="h-4 w-4 mr-2" />
      New Invoice
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {invoice?.id ? "Edit Invoice" : "New Invoice"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number *</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                required
                readOnly={!invoice?.id} // Auto-generated for new invoices
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_id">Customer *</Label>
              <Select
                value={formData.customer_id}
                onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Net Amount (€) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date ? format(formData.due_date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.due_date}
                    onSelect={(date) => setFormData({ ...formData, due_date: date })}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vat_rate">VAT Rate</Label>
              <Select
                value={formData.vat_rate.toString()}
                onValueChange={(value) => setFormData({ ...formData, vat_rate: parseFloat(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0% (Exempt)</SelectItem>
                  <SelectItem value="0.05">5%</SelectItem>
                  <SelectItem value="0.18">18% (Standard)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Calculation Summary */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Net Amount:</span>
              <span>€{netAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>VAT ({(formData.vat_rate * 100).toFixed(0)}%):</span>
              <span>€{vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-2">
              <span>Total Amount:</span>
              <span>€{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : invoice?.id ? "Update Invoice" : "Create Invoice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}