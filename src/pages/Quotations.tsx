
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
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Mail,
  ArrowRight,
} from "lucide-react";

const Quotations = () => {
  const quotations = [
    {
      id: "QUO-2024-001",
      customer: "Potential Client A",
      amount: "€1,850.00",
      status: "draft",
      validUntil: "2024-02-15",
      issueDate: "2024-01-15",
    },
    {
      id: "QUO-2024-002",
      customer: "New Business Ltd",
      amount: "€3,200.00",
      status: "sent",
      validUntil: "2024-02-20",
      issueDate: "2024-01-20",
    },
    {
      id: "QUO-2024-003",
      customer: "Growth Company",
      amount: "€950.00",
      status: "accepted",
      validUntil: "2024-02-10",
      issueDate: "2024-01-10",
    },
    {
      id: "QUO-2024-004",
      customer: "Enterprise Corp",
      amount: "€5,500.00",
      status: "converted",
      validUntil: "2024-01-25",
      issueDate: "2023-12-25",
    },
  ];

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      accepted: "bg-green-100 text-green-800",
      converted: "bg-purple-100 text-purple-800",
      expired: "bg-red-100 text-red-800",
    };
    return variants[status as keyof typeof variants] || variants.draft;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
                <p className="text-muted-foreground">
                  Create and manage quotations for potential customers
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Quotation
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Filters and Search */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search quotations..."
                className="pl-10"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>All Quotations</DropdownMenuItem>
                <DropdownMenuItem>Draft</DropdownMenuItem>
                <DropdownMenuItem>Sent</DropdownMenuItem>
                <DropdownMenuItem>Accepted</DropdownMenuItem>
                <DropdownMenuItem>Converted</DropdownMenuItem>
                <DropdownMenuItem>Expired</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Quotations Table */}
          <Card>
            <CardHeader>
              <CardTitle>Quotation List</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quotation) => (
                    <TableRow key={quotation.id}>
                      <TableCell className="font-medium">{quotation.id}</TableCell>
                      <TableCell>{quotation.customer}</TableCell>
                      <TableCell>{quotation.amount}</TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(quotation.status)}>
                          {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{quotation.issueDate}</TableCell>
                      <TableCell>{quotation.validUntil}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {quotation.status === "accepted" && (
                            <Button size="sm" variant="default">
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Convert to Invoice
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Email
                              </DropdownMenuItem>
                              {quotation.status === "accepted" && (
                                <DropdownMenuItem>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Convert to Invoice
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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

export default Quotations;
