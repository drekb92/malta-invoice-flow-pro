import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Customer {
  id?: string;
  name: string;
  email: string;
  phone: string;
  vat_number: string;
  address: string;
  payment_terms: string;
  vat_status: string;
  client_type: string;
  business_name: string;
  notes: string;
  date_added?: string;
}

interface CustomerFormProps {
  customer?: Customer;
  onSave: () => void;
  trigger?: React.ReactNode;
}

export function CustomerForm({ customer, onSave, trigger }: CustomerFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<Customer>({
    name: customer?.name || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    vat_number: customer?.vat_number || "",
    address: customer?.address || "",
    payment_terms: customer?.payment_terms || "Net 30",
    vat_status: customer?.vat_status || "",
    client_type: customer?.client_type || "Individual",
    business_name: customer?.business_name || "",
    notes: customer?.notes || "",
  });

  const [showVatWarning, setShowVatWarning] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check VAT status warning
    if (!formData.vat_status) {
      setShowVatWarning(true);
    } else {
      setShowVatWarning(false);
    }
    
    setLoading(true);

    try {
      if (customer?.id) {
        // Update existing customer
        const { error } = await supabase
          .from("customers")
          .update(formData)
          .eq("id", customer.id);

        if (error) throw error;
        
        toast({
          title: "Customer updated",
          description: "Customer information has been successfully updated.",
        });
      } else {
        // Create new customer
        if (!user?.id) {
          throw new Error("User not authenticated");
        }
        
        const { error } = await supabase
          .from("customers")
          .insert([{ ...formData, user_id: user.id }]);

        if (error) throw error;
        
        toast({
          title: "Customer created",
          description: "New customer has been successfully added.",
        });
      }

      setOpen(false);
      onSave();
      
      // Reset form if creating new customer
      if (!customer?.id) {
        setFormData({
          name: "",
          email: "",
          phone: "",
          vat_number: "",
          address: "",
          payment_terms: "Net 30",
          vat_status: "",
          client_type: "Individual",
          business_name: "",
          notes: "",
        });
        setShowVatWarning(false);
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

  const defaultTrigger = customer?.id ? (
    <Button variant="ghost" size="sm">
      <Edit className="h-4 w-4" />
    </Button>
  ) : (
    <Button size="sm">
      <Plus className="h-4 w-4 mr-2" />
      New Customer
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {customer?.id ? "Edit Customer" : "New Customer"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vat_number">VAT Number</Label>
                      <Input
                        id="vat_number"
                        value={formData.vat_number}
                        onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Client Type */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Client Type</h3>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label>Client Type</Label>
                      <RadioGroup
                        value={formData.client_type}
                        onValueChange={(value) => setFormData({ ...formData, client_type: value })}
                        className="flex flex-col space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Individual" id="individual" />
                          <Label htmlFor="individual">Individual</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Business" id="business" />
                          <Label htmlFor="business">Business</Label>
                        </div>
                      </RadioGroup>
                    </div>
                    
                    {formData.client_type === "Business" && (
                      <div className="space-y-2">
                        <Label htmlFor="business_name">Business Name *</Label>
                        <Input
                          id="business_name"
                          value={formData.business_name}
                          onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                          required={formData.client_type === "Business"}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* VAT Information */}
                <div>
                  <h3 className="text-lg font-medium mb-4">VAT Information</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="vat_status">VAT Status</Label>
                      <Select
                        value={formData.vat_status}
                        onValueChange={(value) => {
                          setFormData({ ...formData, vat_status: value });
                          setShowVatWarning(false);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select VAT status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Standard (18%)">Standard (18%)</SelectItem>
                          <SelectItem value="Exempt">Exempt</SelectItem>
                          <SelectItem value="Reverse Charge">Reverse Charge</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {showVatWarning && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          VAT status is not selected. Please specify the VAT status for this customer.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>

                {/* Payment Terms */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Payment Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="payment_terms">Payment Terms</Label>
                    <Select
                      value={formData.payment_terms}
                      onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Net 7">Net 7</SelectItem>
                        <SelectItem value="Net 30">Net 30</SelectItem>
                        <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Address and Notes */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Additional Information</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        rows={3}
                        placeholder="Street address, city, postal code, country"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Internal use)</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        placeholder="Internal notes about this customer"
                      />
                    </div>
                  </div>
                </div>

                {/* Date Added (Read-only) */}
                {customer?.date_added && (
                  <div>
                    <h3 className="text-lg font-medium mb-4">System Information</h3>
                    <div className="space-y-2">
                      <Label>Date Added</Label>
                      <Input
                        value={new Date(customer.date_added).toLocaleString()}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse sm:flex-row justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Saving..." : customer?.id ? "Update Customer" : "Create Customer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}