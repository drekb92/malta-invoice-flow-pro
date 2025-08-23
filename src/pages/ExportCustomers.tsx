import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Customer {
  id: string;
  name: string;
  business_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  vat_status?: string;
  vat_number?: string;
  payment_terms?: string;
  notes?: string;
  client_type?: string;
  date_added?: string;
}

const ExportCustomers: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [clientTypes, setClientTypes] = useState<string[]>([]);
  const [vatStatuses, setVatStatuses] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const clientTypeOptions = ["Business", "Individual"];
  const vatStatusOptions = ["Registered", "Not Registered", "Exempt", "EU/Foreign"];

  useEffect(() => {
    fetchCustomers();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, clientTypes, vatStatuses, customers]);

  const fetchCustomers = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = customers.filter((customer) => {
      const matchesSearch = 
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.vat_number?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesClientType = clientTypes.length === 0 || clientTypes.includes(customer.client_type || "");
      const matchesVatStatus = vatStatuses.length === 0 || vatStatuses.includes(customer.vat_status || "");

      return matchesSearch && matchesClientType && matchesVatStatus;
    });

    setFilteredCustomers(filtered);
  };

  const handleClientTypeChange = (type: string, checked: boolean) => {
    setClientTypes(prev => 
      checked ? [...prev, type] : prev.filter(t => t !== type)
    );
  };

  const handleVatStatusChange = (status: string, checked: boolean) => {
    setVatStatuses(prev => 
      checked ? [...prev, status] : prev.filter(s => s !== status)
    );
  };

  const exportToCsv = () => {
    const headers = [
      "Client Type",
      "Business Name",
      "Contact Name", 
      "Email",
      "Phone",
      "Address",
      "VAT Status",
      "VAT Number",
      "Payment Terms",
      "Preferred Currency",
      "Notes",
      "Status",
      "Date Added (YYYY-MM-DD)"
    ];

    const csvContent = [
      headers.join(","),
      ...filteredCustomers.map(customer => [
        customer.client_type || "",
        customer.business_name || "",
        customer.name || "",
        customer.email || "",
        customer.phone || "",
        customer.address || "",
        customer.vat_status || "",
        customer.vat_number || "",
        customer.payment_terms || "",
        "", // Preferred Currency - not in current schema
        customer.notes || "",
        "Active", // Status - not in current schema, defaulting to Active
        customer.date_added ? format(new Date(customer.date_added), "yyyy-MM-dd") : ""
      ].map(field => `"${field.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `clients_export_${format(new Date(), "yyyyMMdd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Complete",
      description: `Exported ${filteredCustomers.length} clients to CSV`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/customers")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Export Clients</h1>
            <p className="text-muted-foreground">
              Filter and export your client database to CSV
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Filters Card */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>
                Configure your export criteria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search */}
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search by name, business name, email, or VAT number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Client Type */}
              <div className="space-y-2">
                <Label>Client Type</Label>
                <div className="space-y-2">
                  {clientTypeOptions.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`client-type-${type}`}
                        checked={clientTypes.includes(type)}
                        onCheckedChange={(checked) => handleClientTypeChange(type, !!checked)}
                      />
                      <Label htmlFor={`client-type-${type}`} className="text-sm">
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* VAT Status */}
              <div className="space-y-2">
                <Label>VAT Status</Label>
                <div className="space-y-2">
                  {vatStatusOptions.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`vat-status-${status}`}
                        checked={vatStatuses.includes(status)}
                        onCheckedChange={(checked) => handleVatStatusChange(status, !!checked)}
                      />
                      <Label htmlFor={`vat-status-${status}`} className="text-sm">
                        {status}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={applyFilters} className="w-full">
                Apply Filters
              </Button>
            </CardContent>
          </Card>

          {/* Preview Card */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {filteredCustomers.length} clients will be exported
              </CardDescription>
              <Button 
                onClick={exportToCsv}
                className="w-full"
                disabled={filteredCustomers.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client Name / Business Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>VAT No.</TableHead>
                      <TableHead>VAT Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Payment Terms</TableHead>
                      <TableHead>Date Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          Loading customers...
                        </TableCell>
                      </TableRow>
                    ) : filteredCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No customers match your filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCustomers.slice(0, 10).map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            {customer.business_name || customer.name}
                          </TableCell>
                          <TableCell>{customer.email || "-"}</TableCell>
                          <TableCell>{customer.vat_number || "-"}</TableCell>
                          <TableCell>{customer.vat_status || "-"}</TableCell>
                          <TableCell>{customer.client_type || "-"}</TableCell>
                          <TableCell>{customer.payment_terms || "-"}</TableCell>
                          <TableCell>
                            {customer.date_added 
                              ? format(new Date(customer.date_added), "yyyy-MM-dd")
                              : "-"
                            }
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {filteredCustomers.length > 10 && (
                  <div className="p-4 text-sm text-muted-foreground border-t">
                    Showing first 10 of {filteredCustomers.length} clients. All will be included in the export.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ExportCustomers;