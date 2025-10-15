import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Building,
  CreditCard,
  Users,
  FileText,
  Palette,
  Sparkles,
} from "lucide-react";
import { z } from "zod";

// Validation schemas
const companySchema = z.object({
  company_name: z.string().trim().min(2, "Company name must be at least 2 characters").max(100),
  company_address: z.string().trim().min(5, "Address must be at least 5 characters").max(500),
  company_vat_number: z.string().trim().min(8, "VAT number must be at least 8 characters").max(20),
  company_email: z.string().trim().email("Invalid email address").max(255),
  company_phone: z.string().trim().min(8, "Phone must be at least 8 characters").max(20),
});

const bankingSchema = z.object({
  bank_name: z.string().trim().min(2, "Bank name required").max(100),
  bank_account_name: z.string().trim().min(2, "Account name required").max(100),
  bank_iban: z.string().trim().min(15, "IBAN must be at least 15 characters").max(34),
});

const customerSchema = z.object({
  name: z.string().trim().min(2, "Customer name required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  vat_number: z.string().trim().min(8).max(20).optional(),
  payment_terms: z.string().trim().min(1).max(50),
});

type OnboardingStep = 'welcome' | 'company' | 'banking' | 'customer' | 'invoice' | 'template' | 'complete';

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Form states
  const [companyData, setCompanyData] = useState({
    company_name: '',
    company_address: '',
    company_vat_number: '',
    company_email: '',
    company_phone: '',
    company_country: 'Malta',
  });

  const [bankingData, setBankingData] = useState({
    bank_name: '',
    bank_account_name: '',
    bank_iban: '',
  });

  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    vat_number: '',
    payment_terms: '30 days',
  });

  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  const steps: OnboardingStep[] = ['welcome', 'company', 'banking', 'customer', 'invoice', 'template', 'complete'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  useEffect(() => {
    checkExistingData();
  }, [user]);

  const checkExistingData = async () => {
    if (!user) return;

    try {
      // Check if user has already completed onboarding
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (preferences?.onboarding_completed) {
        navigate('/');
        return;
      }

      // Check for existing data to pre-fill forms
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (companySettings) {
        setCompanyData({
          company_name: companySettings.company_name || '',
          company_address: companySettings.company_address || '',
          company_vat_number: companySettings.company_vat_number || '',
          company_email: companySettings.company_email || '',
          company_phone: companySettings.company_phone || '',
          company_country: companySettings.company_country || 'Malta',
        });
      }

      const { data: bankingSettings } = await supabase
        .from('banking_details')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (bankingSettings) {
        setBankingData({
          bank_name: bankingSettings.bank_name || '',
          bank_account_name: bankingSettings.bank_account_name || '',
          bank_iban: bankingSettings.bank_iban || '',
        });
      }
    } catch (error) {
      console.error('Error checking existing data:', error);
    }
  };

  const saveCompanyInfo = async () => {
    try {
      const validated = companySchema.parse(companyData);
      setLoading(true);

      const { error } = await supabase
        .from('company_settings')
        .upsert({
          user_id: user!.id,
          ...validated,
          company_country: companyData.company_country,
        });

      if (error) throw error;

      setCompletedSteps([...completedSteps, 'company']);
      toast({
        title: "Company information saved",
        description: "Your business details have been recorded.",
      });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error saving company info",
          description: "Please try again.",
          variant: "destructive",
        });
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const saveBankingInfo = async () => {
    try {
      const validated = bankingSchema.parse(bankingData);
      setLoading(true);

      const { error } = await supabase
        .from('banking_details')
        .upsert({
          user_id: user!.id,
          ...validated,
        });

      if (error) throw error;

      setCompletedSteps([...completedSteps, 'banking']);
      toast({
        title: "Banking details saved",
        description: "Your payment information has been recorded.",
      });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error saving banking info",
          description: "Please try again.",
          variant: "destructive",
        });
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createCustomer = async () => {
    try {
      const validated = customerSchema.parse(customerData);
      setLoading(true);

      const { data, error } = await supabase
        .from('customers')
        .insert([{
          user_id: user!.id,
          name: validated.name,
          email: validated.email,
          vat_number: validated.vat_number,
          payment_terms: validated.payment_terms,
        }])
        .select()
        .single();

      if (error) throw error;

      setCreatedCustomerId(data.id);
      setCompletedSteps([...completedSteps, 'customer']);
      toast({
        title: "First customer created",
        description: `${validated.name} has been added to your customer list.`,
      });
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error creating customer",
          description: "Please try again.",
          variant: "destructive",
        });
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const createSampleInvoice = async () => {
    if (!createdCustomerId) return false;

    try {
      setLoading(true);

      // Get next invoice number
      const { data: invoiceNumber } = await supabase.rpc('next_invoice_number', {
        p_business_id: user!.id,
        p_prefix: 'INV-',
      });

      // Create invoice
      const invoiceDate = new Date().toISOString().split('T')[0];
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user!.id,
          customer_id: createdCustomerId,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          status: 'draft',
          vat_rate: 0.18,
          total_amount: 590,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const items = [
        { description: 'Consulting Services', quantity: 5, unit_price: 100, unit: 'hours' },
      ];

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(
          items.map(item => ({
            invoice_id: invoice.id,
            ...item,
            vat_rate: 0.18,
          }))
        );

      if (itemsError) throw itemsError;

      setCreatedInvoiceId(invoice.id);
      setCompletedSteps([...completedSteps, 'invoice']);
      toast({
        title: "Sample invoice created",
        description: "Your first invoice is ready for review.",
      });
      return true;
    } catch (error) {
      toast({
        title: "Error creating invoice",
        description: "Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      setLoading(true);

      // Mark onboarding as complete
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user!.id,
          onboarding_completed: true,
        });

      if (error) throw error;

      toast({
        title: "Onboarding complete!",
        description: "You're all set to start managing your invoices.",
      });

      // Navigate to dashboard
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      toast({
        title: "Error completing onboarding",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    let canProceed = true;

    switch (currentStep) {
      case 'welcome':
        setCurrentStep('company');
        break;
      case 'company':
        canProceed = await saveCompanyInfo();
        if (canProceed) setCurrentStep('banking');
        break;
      case 'banking':
        canProceed = await saveBankingInfo();
        if (canProceed) setCurrentStep('customer');
        break;
      case 'customer':
        canProceed = await createCustomer();
        if (canProceed) setCurrentStep('invoice');
        break;
      case 'invoice':
        canProceed = await createSampleInvoice();
        if (canProceed) setCurrentStep('template');
        break;
      case 'template':
        setCompletedSteps([...completedSteps, 'template']);
        setCurrentStep('complete');
        break;
      case 'complete':
        await completeOnboarding();
        break;
    }
  };

  const handleBack = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-4">Welcome to Malta Invoice Pro</h2>
              <p className="text-muted-foreground text-lg mb-6">
                Let's get you set up with compliant invoicing in just a few steps
              </p>
            </div>
            <div className="grid gap-4 text-left max-w-md mx-auto">
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold">Malta VAT Compliance</h3>
                  <p className="text-sm text-muted-foreground">
                    Automatic 18% VAT calculations and compliant invoice formatting
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold">Professional Templates</h3>
                  <p className="text-sm text-muted-foreground">
                    Customizable invoice designs with your branding
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold">Payment Tracking</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitor outstanding invoices and payment status
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'company':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Building className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Company Information</h2>
                <p className="text-muted-foreground">This will appear on all your invoices</p>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={companyData.company_name}
                  onChange={(e) => setCompanyData({ ...companyData, company_name: e.target.value })}
                  placeholder="Your Company Ltd"
                  maxLength={100}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company_vat_number">Malta VAT Number *</Label>
                <Input
                  id="company_vat_number"
                  value={companyData.company_vat_number}
                  onChange={(e) => setCompanyData({ ...companyData, company_vat_number: e.target.value })}
                  placeholder="MT12345678"
                  maxLength={20}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company_address">Business Address *</Label>
                <Textarea
                  id="company_address"
                  value={companyData.company_address}
                  onChange={(e) => setCompanyData({ ...companyData, company_address: e.target.value })}
                  placeholder="Street, City, Postal Code"
                  rows={3}
                  maxLength={500}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="company_email">Email Address *</Label>
                  <Input
                    id="company_email"
                    type="email"
                    value={companyData.company_email}
                    onChange={(e) => setCompanyData({ ...companyData, company_email: e.target.value })}
                    placeholder="info@company.com"
                    maxLength={255}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company_phone">Phone Number *</Label>
                  <Input
                    id="company_phone"
                    type="tel"
                    value={companyData.company_phone}
                    onChange={(e) => setCompanyData({ ...companyData, company_phone: e.target.value })}
                    placeholder="+356 1234 5678"
                    maxLength={20}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'banking':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Banking Details</h2>
                <p className="text-muted-foreground">Where customers should send payments</p>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bank_name">Bank Name *</Label>
                <Input
                  id="bank_name"
                  value={bankingData.bank_name}
                  onChange={(e) => setBankingData({ ...bankingData, bank_name: e.target.value })}
                  placeholder="Bank of Valletta"
                  maxLength={100}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bank_account_name">Account Holder Name *</Label>
                <Input
                  id="bank_account_name"
                  value={bankingData.bank_account_name}
                  onChange={(e) => setBankingData({ ...bankingData, bank_account_name: e.target.value })}
                  placeholder="Your Company Ltd"
                  maxLength={100}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bank_iban">IBAN *</Label>
                <Input
                  id="bank_iban"
                  value={bankingData.bank_iban}
                  onChange={(e) => setBankingData({ ...bankingData, bank_iban: e.target.value.toUpperCase() })}
                  placeholder="MT84VALL22013000000123456789"
                  maxLength={34}
                />
                <p className="text-xs text-muted-foreground">
                  This will appear on invoices for customer payments
                </p>
              </div>
            </div>
          </div>
        );

      case 'customer':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Create Your First Customer</h2>
                <p className="text-muted-foreground">Add a customer to issue invoices to</p>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Input
                  id="customer_name"
                  value={customerData.name}
                  onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                  placeholder="Acme Corporation"
                  maxLength={100}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer_email">Email Address *</Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={customerData.email}
                  onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                  placeholder="contact@acme.com"
                  maxLength={255}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer_vat">VAT Number (Optional)</Label>
                <Input
                  id="customer_vat"
                  value={customerData.vat_number}
                  onChange={(e) => setCustomerData({ ...customerData, vat_number: e.target.value })}
                  placeholder="MT98765432"
                  maxLength={20}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment_terms">Payment Terms *</Label>
                <Input
                  id="payment_terms"
                  value={customerData.payment_terms}
                  onChange={(e) => setCustomerData({ ...customerData, payment_terms: e.target.value })}
                  placeholder="30 days"
                  maxLength={50}
                />
              </div>
            </div>
          </div>
        );

      case 'invoice':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Generate Sample Invoice</h2>
                <p className="text-muted-foreground">Let's create your first invoice</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-semibold">{customerData.name}</p>
                </div>
                <Badge>Draft</Badge>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm">Consulting Services (5 hours @ €100)</span>
                  <span className="font-medium">€500.00</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>VAT (18%)</span>
                  <span>€90.00</span>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">€590.00</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Click next to create this sample invoice with Malta VAT compliance
            </p>
          </div>
        );

      case 'template':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Palette className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Invoice Template</h2>
                <p className="text-muted-foreground">Customize your invoice appearance</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Default Template Applied</h3>
                  <p className="text-sm text-muted-foreground">
                    Professional, Malta VAT-compliant design
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Customization Available</h3>
                  <p className="text-sm text-muted-foreground">
                    Change colors, fonts, and layout in Settings → Templates
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-semibold">PDF Export Ready</h3>
                  <p className="text-sm text-muted-foreground">
                    Download professional PDFs for any invoice
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (createdInvoiceId) {
                  window.open(`/invoices/${createdInvoiceId}`, '_blank');
                }
              }}
              disabled={!createdInvoiceId}
            >
              Preview Your Sample Invoice
            </Button>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-4">You're All Set!</h2>
              <p className="text-muted-foreground text-lg">
                Your account is configured and ready to use
              </p>
            </div>
            <div className="grid gap-3 max-w-md mx-auto">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Company Information</span>
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Banking Details</span>
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">First Customer</span>
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Sample Invoice</span>
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Click finish to start managing your invoices
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Step {currentStepIndex + 1} of {steps.length}
                </CardTitle>
              </div>
              {currentStep !== 'welcome' && currentStep !== 'complete' && (
                <Badge variant="outline">Required</Badge>
              )}
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {renderStepContent()}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 'welcome' || loading}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={loading}>
                {loading ? (
                  "Processing..."
                ) : currentStep === 'complete' ? (
                  "Finish"
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
