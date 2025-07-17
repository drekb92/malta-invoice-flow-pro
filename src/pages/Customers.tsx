
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Upload,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  Mail,
} from "lucide-react";

const Customers = () => {
  const customers = [
    {
      id: "CUST-001",
      name: "Acme Corporation",
      email: "contact@acme.com",
      phone: "+356 1234 5678",
      vatNumber: "MT12345678",
      paymentTerms: "Net 30",
      totalInvoiced: "€12,450.00",
      outstanding: "€1,200.00",
      status: "active",
    },
    {
      id: "CUST-002",
      name: "Tech Solutions Ltd",
      email: "info@techsolutions.com",
      phone: "+356 9876 5432",
      vatNumber: "MT87654321",
      paymentTerms: "Net 15",
      totalInvoiced: "€8,920.00",
      outstanding: "€2,450.00",
      status: "active",
    },
    {
      id: "CUST-003",
      name: "Global Enterprises",
      email: "billing@global.com",
      phone: "+356 5555 1234",
      vatNumber: "MT11223344",
      paymentTerms: "Net 45",
      totalInvoiced: "€15,750.00",
      outstanding: "€3,750.00",
      status: "active",
    },
    {
      id: "CUST-004",
      name: "Local Business",
      email: "admin@localbiz.mt",
      phone: "+356 7777 8888",
      vatNumber: "MT99887766",
      paymentTerms: "Net 0",
      totalInvoiced: "€3,200.00",
      outstanding: "€850.00",
      status: "inactive",
    },
  ];

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
    };
    return variants[status as keyof typeof variants] || variants.inactive;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Customers</h1>
                <p className="text-muted-foreground">
                  Manage your customer database and payment terms
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Customer
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Search */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search customers..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Customers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Customer List</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>VAT Number</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Total Invoiced</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-muted-foreground">{customer.id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{customer.email}</div>
                          <div className="text-sm text-muted-foreground">{customer.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>{customer.vatNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{customer.paymentTerms}</Badge>
                      </TableCell>
                      <TableCell>{customer.totalInvoiced}</TableCell>
                      <TableCell className="font-medium">{customer.outstanding}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(customer.status)}>
                          {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Customer
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Customers;
