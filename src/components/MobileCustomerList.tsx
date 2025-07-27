import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vat_number?: string;
  payment_terms?: string;
  address?: string;
  vat_status?: string;
  client_type?: string;
  business_name?: string;
  notes?: string;
  date_added?: string;
}

interface MobileCustomerListProps {
  customers: Customer[];
  onViewCustomer?: (customer: Customer) => void;
  onCreateInvoice?: (customer: Customer) => void;
}

export function MobileCustomerList({ customers, onViewCustomer, onCreateInvoice }: MobileCustomerListProps) {
  const getStatusBadge = (customer: Customer) => {
    const daysSinceAdded = customer.date_added 
      ? Math.floor((Date.now() - new Date(customer.date_added).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    if (daysSinceAdded <= 30) {
      return <Badge variant="default">New</Badge>;
    } else if (daysSinceAdded <= 90) {
      return <Badge variant="secondary">Active</Badge>;
    } else {
      return <Badge variant="outline">Inactive</Badge>;
    }
  };

  // Mock outstanding balance - in real app this would come from invoices
  const getOutstandingBalance = () => {
    return (Math.random() * 5000).toFixed(2);
  };

  return (
    <div className="space-y-4">
      {customers.map((customer) => (
        <Card key={customer.id} className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{customer.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
          </CardHeader>
          
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">VAT: {customer.vat_number || 'N/A'}</span>
              <span className="text-muted-foreground">{customer.payment_terms || 'Net 30'}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                {getStatusBadge(customer)}
              </div>
              <span className="text-sm font-medium">
                Outstanding: ${getOutstandingBalance()}
              </span>
            </div>
          </CardContent>
          
          <CardFooter className="flex gap-2 pt-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onViewCustomer?.(customer)}
            >
              View
            </Button>
            <Button 
              size="sm" 
              className="flex-1"
              onClick={() => onCreateInvoice?.(customer)}
            >
              + Invoice
            </Button>
          </CardFooter>
        </Card>
      ))}
      
      {customers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No customers found
        </div>
      )}
    </div>
  );
}