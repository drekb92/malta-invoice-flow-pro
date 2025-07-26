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
import { format, addDays } from "date-fns";
import { Plus, Edit, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { InvoiceLineItems, LineItem } from "./InvoiceLineItems";
import { useAuth } from "@/hooks/useAuth";

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
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    invoice_number: invoice?.invoice_number || "",
    customer_id: invoice?.customer_id || "",
    invoice_date: invoice ? new Date(invoice.due_date) : new Date(),
    due_date: invoice ? new Date(invoice.due_date) : undefined as Date | undefined,
    status: invoice?.status || "draft",
  });

  // Calculate totals from line items
  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const vatTotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price * item.vat_rate), 0);
    const grandTotal = subtotal + vatTotal;
    return { subtotal, vatTotal, grandTotal };
  };

  const { subtotal, vatTotal, grandTotal } = calculateTotals();

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
      if (lineItems.length === 0) {
        throw new Error("At least one line item is required");
      }

      // Get selected customer's payment terms to calculate due date
      const selectedCustomer = customers.find(c => c.id === formData.customer_id);
      const paymentTerms = selectedCustomer?.payment_terms || "Net 30";
      
      // Extract number of days from payment terms (e.g., "Net 30" -> 30)
      const daysMatch = paymentTerms.match(/\d+/);
      const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
      
      // Calculate due date from invoice date + payment terms
      const calculatedDueDate = addDays(formData.invoice_date, paymentDays);

      const invoiceData = {
        invoice_number: formData.invoice_number,
        customer_id: formData.customer_id,
        amount: subtotal,
        vat_rate: 0.18, // Average VAT rate or calculated from line items
        invoice_date: formData.invoice_date.toISOString().split('T')[0],
        due_date: calculatedDueDate.toISOString().split('T')[0],
        status: formData.status,
      };

      if (invoice?.id) {
        // Update existing invoice
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update(invoiceData)
          .eq("id", invoice.id);

        if (invoiceError) throw invoiceError;

        // Delete existing line items and insert new ones
        const { error: deleteError } = await supabase
          .from("invoice_items" as any)
          .delete()
          .eq("invoice_id", invoice.id);

        if (deleteError) throw deleteError;

        const lineItemsData = lineItems.map(item => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
        }));

        const { error: itemsError } = await supabase
          .from("invoice_items" as any)
          .insert(lineItemsData);

        if (itemsError) throw itemsError;
        
        toast({
          title: "Invoice updated",
          description: "Invoice has been successfully updated.",
        });
      } else {
        // Create new invoice
        if (!user?.id) {
          throw new Error("User not authenticated");
        }
        
        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert([{ ...invoiceData, user_id: user.id }])
          .select("id")
          .single();

        if (invoiceError) throw invoiceError;

        // Insert line items
        const lineItemsData = lineItems.map(item => ({
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
        }));

        const { error: itemsError } = await supabase
          .from("invoice_items" as any)
          .insert(lineItemsData);

        if (itemsError) throw itemsError;
        
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
          invoice_date: new Date(),
          due_date: undefined,
          status: "draft",
        });
        setLineItems([]);
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {invoice?.id ? "Edit Invoice" : "New Invoice"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <form onSubmit={handleSubmit} className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
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
                  <Label htmlFor="invoice_date">Invoice Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.invoice_date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.invoice_date}
                        onSelect={(date) => setFormData({ ...formData, invoice_date: date || new Date() })}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {formData.customer_id && (
                    <div className="text-sm text-muted-foreground">
                      Due: {(() => {
                        const selectedCustomer = customers.find(c => c.id === formData.customer_id);
                        const paymentTerms = selectedCustomer?.payment_terms || "Net 30";
                        const daysMatch = paymentTerms.match(/\d+/);
                        const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
                        const calculatedDueDate = addDays(formData.invoice_date, paymentDays);
                        return format(calculatedDueDate, "PPP");
                      })()}
                    </div>
                  )}
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

              <InvoiceLineItems 
                lineItems={lineItems}
                onLineItemsChange={setLineItems}
              />
            </div>

            <div className="flex-shrink-0 border-t pt-4 mt-4 bg-background">
              <div className="flex justify-end space-x-2">
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
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}