import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, Save, Building, User, Lock, Unlock, Info } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { generateCustomerCode, sanitizeCustomerCode, makeCodeUnique } from "@/lib/customerCode";

interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  locality: string;
  post_code: string;
  vat_number: string;
  vat_status: string;
  payment_terms: string;
  business_name: string;
  client_type: string;
  notes: string;
  customer_code: string;
}

const EditCustomer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>({
    name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    locality: "",
    post_code: "",
    vat_number: "",
    vat_status: "",
    payment_terms: "Net 30",
    business_name: "",
    client_type: "Business",
    notes: "",
    customer_code: "",
  });
  const [originalData, setOriginalData] = useState<CustomerFormData | null>(null);
  const [hasIssuedInvoices, setHasIssuedInvoices] = useState(false);
  const [codeMode, setCodeMode] = useState<'auto' | 'custom'>('custom');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [existingCodes, setExistingCodes] = useState<string[]>([]);

  // Handle browser back/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (user && id) {
      fetchCustomer();
      checkIssuedInvoices();
      fetchExistingCodes();
    }
  }, [user, id]);

  const fetchExistingCodes = async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from("customers")
      .select("customer_code")
      .eq("user_id", user.id)
      .neq("id", id) // Exclude current customer
      .not("customer_code", "is", null);
    
    const codes = (data || [])
      .map(c => c.customer_code)
      .filter((code): code is string => code !== null);
    setExistingCodes(codes);
  };

  const checkIssuedInvoices = async () => {
    if (!id) return;
    
    const { data } = await supabase
      .from("invoices")
      .select("id")
      .eq("customer_id", id)
      .eq("is_issued", true)
      .limit(1);
    
    setHasIssuedInvoices((data || []).length > 0);
  };

  const fetchCustomer = async () => {
    if (!user || !id) return;

    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Customer not found",
          description: "The customer you're looking for doesn't exist or you don't have access.",
          variant: "destructive",
        });
        navigate("/customers");
        return;
      }

      const customerData = {
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        address_line1: data.address_line1 || "",
        address_line2: data.address_line2 || "",
        locality: data.locality || "",
        post_code: data.post_code || "",
        vat_number: data.vat_number || "",
        vat_status: data.vat_status || "",
        payment_terms: data.payment_terms || "Net 30",
        business_name: data.business_name || "",
        client_type: data.client_type || "Business",
        notes: data.notes || "",
        customer_code: data.customer_code || "",
      };
      setFormData(customerData);
      setOriginalData(customerData);
      
      // Set code mode based on whether customer has a code
      if (customerData.customer_code) {
        setCodeMode('custom');
      } else {
        setCodeMode('auto');
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
      toast({
        title: "Error",
        description: "Failed to load customer details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      // Check if form is dirty by comparing with original
      if (originalData) {
        const hasChanges = Object.keys(newData).some(
          (key) => newData[key as keyof CustomerFormData] !== originalData[key as keyof CustomerFormData]
        );
        setIsDirty(hasChanges);
      }
      return newData;
    });
  };

  const handleCustomCodeChange = (value: string) => {
    const sanitized = sanitizeCustomerCode(value);
    handleChange("customer_code", sanitized);
    setCodeError(null);
  };

  const handleNavigateBack = () => {
    if (isDirty) {
      pendingNavigationRef.current = `/customers/${id}`;
      setShowExitDialog(true);
    } else {
      navigate(`/customers/${id}`);
    }
  };

  const handleConfirmExit = () => {
    setIsDirty(false);
    setShowExitDialog(false);
    if (pendingNavigationRef.current) {
      navigate(pendingNavigationRef.current);
      pendingNavigationRef.current = null;
    }
  };

  const handleCancelExit = () => {
    setShowExitDialog(false);
    pendingNavigationRef.current = null;
  };

  // Generate auto code when name/business_name changes
  const autoGeneratedCode = generateCustomerCode(
    formData.name,
    formData.client_type === "Business" ? formData.business_name : undefined
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !id) return;

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    setCodeError(null);

    try {
      // Determine final customer code
      let finalCode: string;
      if (hasIssuedInvoices && originalData?.customer_code) {
        // Keep existing code if locked
        finalCode = originalData.customer_code;
      } else if (codeMode === 'auto') {
        finalCode = makeCodeUnique(autoGeneratedCode, existingCodes);
      } else {
        finalCode = formData.customer_code || '';
      }

      // Validate customer code
      if (!finalCode) {
        setCodeError("Customer code is required");
        setSaving(false);
        return;
      }

      // Check uniqueness for custom codes
      if (codeMode === 'custom' && !hasIssuedInvoices && existingCodes.includes(finalCode)) {
        setCodeError("This customer code is already in use");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("customers")
        .update({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          address_line1: formData.address_line1.trim() || null,
          address_line2: formData.address_line2.trim() || null,
          locality: formData.locality.trim() || null,
          post_code: formData.post_code.trim() || null,
          vat_number: formData.vat_number.trim() || null,
          vat_status: formData.vat_status || null,
          payment_terms: formData.payment_terms || null,
          business_name: formData.business_name.trim() || null,
          client_type: formData.client_type || null,
          notes: formData.notes.trim() || null,
          customer_code: finalCode,
        })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        if (error.code === '23505' && error.message.includes('customer_code')) {
          setCodeError("This customer code is already in use");
          setSaving(false);
          return;
        }
        throw error;
      }

      toast({
        title: "Customer updated",
        description: "Customer details have been saved successfully.",
      });

      setIsDirty(false);
      navigate(`/customers/${id}`);
    } catch (error) {
      console.error("Error updating customer:", error);
      toast({
        title: "Error",
        description: "Failed to update customer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to edit customer details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="md:ml-64 p-6">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-96 w-full max-w-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={handleNavigateBack}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Edit Customer</h1>
                  <p className="text-sm text-muted-foreground">Update customer information</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleNavigateBack}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
                <CardDescription>Primary customer details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Customer Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      placeholder="Enter customer name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_type">Client Type</Label>
                    <Select
                      value={formData.client_type}
                      onValueChange={(value) => handleChange("client_type", value)}
                    >
                      <SelectTrigger id="client_type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Individual">Individual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business_name">Business Name</Label>
                  <Input
                    id="business_name"
                    value={formData.business_name}
                    onChange={(e) => handleChange("business_name", e.target.value)}
                    placeholder="Enter business name (if applicable)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="+356 1234 5678"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address_line1">House Name / Number</Label>
                    <Input
                      id="address_line1"
                      value={formData.address_line1}
                      onChange={(e) => handleChange("address_line1", e.target.value)}
                      placeholder="e.g. 123 or Villa Rosa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_line2">Street Name</Label>
                    <Input
                      id="address_line2"
                      value={formData.address_line2}
                      onChange={(e) => handleChange("address_line2", e.target.value)}
                      placeholder="e.g. Republic Street"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="locality">Locality</Label>
                    <Input
                      id="locality"
                      value={formData.locality}
                      onChange={(e) => handleChange("locality", e.target.value)}
                      placeholder="e.g. Valletta"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post_code">Post Code</Label>
                    <Input
                      id="post_code"
                      value={formData.post_code}
                      onChange={(e) => handleChange("post_code", e.target.value)}
                      placeholder="e.g. VLT 1234"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Code */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Customer Code
                  {hasIssuedInvoices && originalData?.customer_code && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Locked: Customer has issued invoices</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {!hasIssuedInvoices && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Unlock className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Editable: No issued invoices yet</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </CardTitle>
                <CardDescription>Unique identifier for this customer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasIssuedInvoices && originalData?.customer_code ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={originalData.customer_code}
                        disabled
                        className="font-mono bg-muted"
                      />
                    </div>
                    <Alert className="bg-muted/50">
                      <Lock className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Customer code is locked because this customer has issued invoices.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <RadioGroup
                      value={codeMode}
                      onValueChange={(value: 'auto' | 'custom') => {
                        setCodeMode(value);
                        setCodeError(null);
                      }}
                      className="flex flex-col space-y-3"
                    >
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="auto" id="code-auto" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="code-auto" className="font-medium">Auto-generate from name</Label>
                          {codeMode === 'auto' && autoGeneratedCode && (
                            <div className="mt-1 px-3 py-2 bg-muted rounded-md">
                              <span className="text-sm text-muted-foreground">Preview: </span>
                              <span className="font-mono font-medium">{autoGeneratedCode}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="custom" id="code-custom" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="code-custom" className="font-medium">Enter custom code</Label>
                          {codeMode === 'custom' && (
                            <div className="mt-2 space-y-2">
                              <div className="relative">
                                <Input
                                  value={formData.customer_code}
                                  onChange={(e) => handleCustomCodeChange(e.target.value)}
                                  placeholder="e.g. CUST001"
                                  maxLength={10}
                                  className={`font-mono uppercase ${codeError ? 'border-destructive' : ''}`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  {formData.customer_code?.length || 0}/10
                                </span>
                              </div>
                              {codeError && (
                                <p className="text-sm text-destructive">{codeError}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </RadioGroup>
                    
                    <Alert className="bg-muted/50">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        This code identifies the customer and will be locked after the first invoice is issued.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tax & Payment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Tax & Payment Information
                </CardTitle>
                <CardDescription>VAT and payment terms</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vat_number">VAT Number</Label>
                    <Input
                      id="vat_number"
                      value={formData.vat_number}
                      onChange={(e) => handleChange("vat_number", e.target.value)}
                      placeholder="MT12345678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vat_status">VAT Status</Label>
                    <Select
                      value={formData.vat_status}
                      onValueChange={(value) => handleChange("vat_status", value)}
                    >
                      <SelectTrigger id="vat_status">
                        <SelectValue placeholder="Select VAT status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VAT Registered">VAT Registered</SelectItem>
                        <SelectItem value="Non-VAT Registered">Non-VAT Registered</SelectItem>
                        <SelectItem value="EU VAT Exempt">EU VAT Exempt</SelectItem>
                        <SelectItem value="Reverse Charge">Reverse Charge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Select
                    value={formData.payment_terms}
                    onValueChange={(value) => handleChange("payment_terms", value)}
                  >
                    <SelectTrigger id="payment_terms">
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                      <SelectItem value="Net 7">Net 7</SelectItem>
                      <SelectItem value="Net 14">Net 14</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 45">Net 45</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Notes</CardTitle>
                <CardDescription>Internal notes about this customer</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Add any notes about this customer..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </form>
        </main>
      </div>

      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelExit}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExit}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EditCustomer;
