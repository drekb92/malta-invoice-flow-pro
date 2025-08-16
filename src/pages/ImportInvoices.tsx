import React, { useState, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { 
  Download, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CSVRow {
  "Invoice Number": string;
  "Invoice Date": string;
  "Due Date": string;
  "Status": string;
  "Client Name": string;
  "Client Email": string;
  "Client VAT": string;
  "Client Address": string;
  "Item Description": string;
  "Quantity": string;
  "Unit Price": string;
  "VAT %": string;
  "Net Line Total": string;
  "VAT Line Total": string;
  "Grand Invoice Total": string;
  "Payment Terms": string;
}

interface ValidationResult {
  row: CSVRow;
  rowIndex: number;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

interface ImportSummary {
  newInvoices: number;
  updatedInvoices: number;
  skippedInvoices: number;
  details: Array<{
    invoiceNumber: string;
    status: 'created' | 'updated' | 'skipped';
    reason?: string;
  }>;
}

const ImportInvoices = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [viewFilter, setViewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const [allowUpdates, setAllowUpdates] = useState(false);
  const [createMissingClients, setCreateMissingClients] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const { toast } = useToast();

  const templateColumns = [
    "Invoice Number", "Invoice Date", "Due Date", "Status", "Client Name", 
    "Client Email", "Client VAT", "Client Address", "Item Description", 
    "Quantity", "Unit Price", "VAT %", "Net Line Total", "VAT Line Total", 
    "Grand Invoice Total", "Payment Terms"
  ];

  const downloadTemplate = () => {
    const sampleData = [
      "INV-2024-001,2024-01-15,2024-02-14,Pending,ABC Company,john@abccompany.com,DE123456789,123 Business St\\, Berlin 10115,Consulting Services,40,125.00,19,5000.00,950.00,5950.00,Net 30",
      "INV-2024-001,2024-01-15,2024-02-14,Pending,ABC Company,john@abccompany.com,DE123456789,123 Business St\\, Berlin 10115,Software License,1,500.00,19,500.00,95.00,5950.00,Net 30"
    ];
    
    const csvContent = [templateColumns.join(","), ...sampleData].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "invoices_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isValidDate = (dateString: string): boolean => {
    if (!dateString) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  };

  const isValidStatus = (status: string): boolean => {
    const validStatuses = ['Draft', 'Pending', 'Paid', 'Overdue', 'Cancelled'];
    return validStatuses.includes(status);
  };

  const validateRow = (row: CSVRow, index: number): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!row["Invoice Number"]?.trim()) {
      errors.push("Invoice Number is required");
    }
    if (!row["Invoice Date"]?.trim()) {
      errors.push("Invoice Date is required");
    }
    if (!row["Client Name"]?.trim() && !row["Client Email"]?.trim()) {
      errors.push("Either Client Name or Client Email is required");
    }
    if (!row["Item Description"]?.trim()) {
      errors.push("Item Description is required");
    }
    if (!row["Quantity"]?.trim()) {
      errors.push("Quantity is required");
    }
    if (!row["Unit Price"]?.trim()) {
      errors.push("Unit Price is required");
    }

    // Date validation
    if (row["Invoice Date"] && !isValidDate(row["Invoice Date"])) {
      errors.push("Invoice Date must be in YYYY-MM-DD format");
    }
    if (row["Due Date"] && !isValidDate(row["Due Date"])) {
      errors.push("Due Date must be in YYYY-MM-DD format");
    }

    // Numeric validation
    if (row["Quantity"]) {
      const quantity = parseFloat(row["Quantity"]);
      if (isNaN(quantity) || quantity < 0) {
        errors.push("Quantity must be a number ≥ 0");
      }
    }
    if (row["Unit Price"]) {
      const unitPrice = parseFloat(row["Unit Price"]);
      if (isNaN(unitPrice) || unitPrice < 0) {
        errors.push("Unit Price must be a number ≥ 0");
      }
    }
    if (row["VAT %"]) {
      const vatRate = parseFloat(row["VAT %"]);
      if (isNaN(vatRate) || vatRate < 0) {
        errors.push("VAT % must be a number ≥ 0");
      }
    }

    // Status validation
    if (row["Status"] && !isValidStatus(row["Status"])) {
      warnings.push("Invalid status, will default to 'Pending'");
    }

    // Optional field warnings
    if (!row["Client VAT"]?.trim()) {
      warnings.push("Missing Client VAT");
    }

    return {
      row,
      rowIndex: index,
      errors,
      warnings,
      isValid: errors.length === 0,
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as CSVRow[];
        setCsvData(data);
        
        // Validate rows
        const validationResults = data.map((row, index) => validateRow(row, index));
        setValidationResults(validationResults);
        setLoading(false);
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        toast({
          title: "Error",
          description: "Failed to parse CSV file",
          variant: "destructive",
        });
        setLoading(false);
      }
    });
  };

  const checkDuplicateInvoices = async (invoiceNumbers: string[]) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_number')
        .in('invoice_number', invoiceNumbers);

      if (error) throw error;
      return new Set((data || []).map(invoice => invoice.invoice_number));
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return new Set();
    }
  };

  const createOrUpdateCustomer = async (clientData: {
    name: string;
    email: string;
    vat_number: string;
    address: string;
  }) => {
    try {
      // Try to find existing customer by email first, then by name
      let query = supabase.from('customers').select('id, name, email');
      
      if (clientData.email) {
        query = query.eq('email', clientData.email);
      } else {
        query = query.eq('name', clientData.name);
      }

      const { data: existingCustomers, error: searchError } = await query;
      if (searchError) throw searchError;

      if (existingCustomers && existingCustomers.length > 0) {
        return existingCustomers[0].id;
      }

      // Create new customer
      const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert({
          name: clientData.name,
          email: clientData.email || null,
          vat_number: clientData.vat_number || null,
          address: clientData.address || null,
        })
        .select('id')
        .single();

      if (createError) throw createError;
      return newCustomer.id;
    } catch (error) {
      console.error('Error creating/updating customer:', error);
      throw error;
    }
  };

  const handleImport = async () => {
    const errorRows = validationResults.filter(result => !result.isValid);
    if (errorRows.length > 0) {
      toast({
        title: "Cannot import with errors",
        description: "Please fix all error rows before importing",
        variant: "destructive",
      });
      return;
    }

    const validRows = validationResults.filter(result => result.isValid);
    if (validRows.length === 0) {
      toast({
        title: "No valid rows",
        description: "No rows to import",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    const summary: ImportSummary = {
      newInvoices: 0,
      updatedInvoices: 0,
      skippedInvoices: 0,
      details: []
    };

    try {
      // Check for duplicate invoice numbers
      const invoiceNumbers = validRows.map(result => result.row["Invoice Number"]);
      const existingInvoices = await checkDuplicateInvoices(invoiceNumbers);

      // Group rows by invoice number
      const invoiceGroups = validRows.reduce((groups, result) => {
        const invoiceNumber = result.row["Invoice Number"];
        if (!groups[invoiceNumber]) {
          groups[invoiceNumber] = [];
        }
        groups[invoiceNumber].push(result.row);
        return groups;
      }, {} as Record<string, CSVRow[]>);

      // Process each invoice
      for (const [invoiceNumber, rows] of Object.entries(invoiceGroups)) {
        try {
          const firstRow = rows[0];
          const isExisting = existingInvoices.has(invoiceNumber);

          if (isExisting && !allowUpdates) {
            summary.skippedInvoices++;
            summary.details.push({
              invoiceNumber,
              status: 'skipped',
              reason: 'Invoice exists and updates not allowed'
            });
            continue;
          }

          // Create or get customer
          let customerId;
          if (createMissingClients) {
            customerId = await createOrUpdateCustomer({
              name: firstRow["Client Name"] || "",
              email: firstRow["Client Email"] || "",
              vat_number: firstRow["Client VAT"] || "",
              address: firstRow["Client Address"] || "",
            });
          } else {
            // Try to find existing customer only
            let query = supabase.from('customers').select('id');
            if (firstRow["Client Email"]) {
              query = query.eq('email', firstRow["Client Email"]);
            } else {
              query = query.eq('name', firstRow["Client Name"]);
            }
            
            const { data: existingCustomers } = await query;
            if (!existingCustomers || existingCustomers.length === 0) {
              summary.skippedInvoices++;
              summary.details.push({
                invoiceNumber,
                status: 'skipped',
                reason: 'Client not found and auto-creation disabled'
              });
              continue;
            }
            customerId = existingCustomers[0].id;
          }

          // Calculate totals
          let netAmount = 0;
          let vatAmount = 0;
          const items = rows.map(row => {
            const quantity = parseFloat(row["Quantity"]) || 0;
            const unitPrice = parseFloat(row["Unit Price"]) || 0;
            const vatRate = parseFloat(row["VAT %"]) / 100 || 0;
            const lineNet = quantity * unitPrice;
            const lineVat = lineNet * vatRate;
            
            netAmount += lineNet;
            vatAmount += lineVat;

            return {
              description: row["Item Description"],
              quantity,
              unit_price: unitPrice,
              vat_rate: vatRate,
            };
          });

          const totalAmount = netAmount + vatAmount;
          const status = isValidStatus(firstRow["Status"]) ? firstRow["Status"] : "Pending";

          if (isExisting && allowUpdates) {
            // Update existing invoice
            const { data: existingInvoice, error: fetchError } = await supabase
              .from('invoices')
              .select('id')
              .eq('invoice_number', invoiceNumber)
              .single();

            if (fetchError) throw fetchError;

            // Update invoice header
            const { error: updateError } = await supabase
              .from('invoices')
              .update({
                invoice_date: firstRow["Invoice Date"],
                due_date: firstRow["Due Date"] || null,
                status,
                customer_id: customerId,
                amount: netAmount,
                vat_amount: vatAmount,
                total_amount: totalAmount,
              })
              .eq('id', existingInvoice.id);

            if (updateError) throw updateError;

            // Delete existing items
            await supabase
              .from('invoice_items')
              .delete()
              .eq('invoice_id', existingInvoice.id);

            // Insert new items
            const { error: itemsError } = await supabase
              .from('invoice_items')
              .insert(
                items.map(item => ({
                  ...item,
                  invoice_id: existingInvoice.id,
                }))
              );

            if (itemsError) throw itemsError;

            summary.updatedInvoices++;
            summary.details.push({
              invoiceNumber,
              status: 'updated'
            });
          } else {
            // Create new invoice
            const { data: newInvoice, error: invoiceError } = await supabase
              .from('invoices')
              .insert({
                invoice_number: invoiceNumber,
                invoice_date: firstRow["Invoice Date"],
                due_date: firstRow["Due Date"] || null,
                status,
                customer_id: customerId,
                amount: netAmount,
                vat_amount: vatAmount,
                total_amount: totalAmount,
              })
              .select('id')
              .single();

            if (invoiceError) throw invoiceError;

            // Insert items
            const { error: itemsError } = await supabase
              .from('invoice_items')
              .insert(
                items.map(item => ({
                  ...item,
                  invoice_id: newInvoice.id,
                }))
              );

            if (itemsError) throw itemsError;

            summary.newInvoices++;
            summary.details.push({
              invoiceNumber,
              status: 'created'
            });
          }
        } catch (error) {
          console.error(`Error processing invoice ${invoiceNumber}:`, error);
          summary.skippedInvoices++;
          summary.details.push({
            invoiceNumber,
            status: 'skipped',
            reason: 'Processing error'
          });
        }
      }

      setImportSummary(summary);
      toast({
        title: "Import Complete",
        description: `Imported ${summary.newInvoices + summary.updatedInvoices} invoices successfully`,
      });

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const filteredResults = validationResults.filter(result => {
    if (viewFilter === 'valid') return result.isValid;
    if (viewFilter === 'errors') return !result.isValid;
    return true;
  });

  const validCount = validationResults.filter(r => r.isValid).length;
  const warningCount = validationResults.filter(r => r.warnings.length > 0).length;
  const errorCount = validationResults.filter(r => !r.isValid).length;

  if (importSummary) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Import Complete</h1>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Import Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{importSummary.newInvoices}</div>
                  <div className="text-sm text-muted-foreground">New Invoices</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{importSummary.updatedInvoices}</div>
                  <div className="text-sm text-muted-foreground">Updated Invoices</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{importSummary.skippedInvoices}</div>
                  <div className="text-sm text-muted-foreground">Skipped Invoices</div>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {importSummary.details.map((detail, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="font-medium">{detail.invoiceNumber}</span>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={
                          detail.status === 'created' ? 'default' :
                          detail.status === 'updated' ? 'secondary' : 'outline'
                        }
                      >
                        {detail.status}
                      </Badge>
                      {detail.reason && (
                        <span className="text-sm text-muted-foreground">{detail.reason}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={() => navigate('/invoices')} className="w-full">
                <ArrowRight className="h-4 w-4 mr-2" />
                Go to Invoices
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Import Invoices</h1>
          <p className="text-muted-foreground">
            Upload a CSV file to import invoices and their items
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <Button onClick={downloadTemplate} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>
          <div className="flex-1 text-sm text-muted-foreground">
            <strong>Format requirements:</strong> Use UTF-8, comma-separated. Dates in YYYY-MM-DD. Amounts with dot decimal.
          </div>
        </div>

        {/* Upload & Preview Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upload & Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div>
              <Label htmlFor="csvFile">Select CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="mt-2"
              />
            </div>

            {/* Validation Summary */}
            {validationResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium text-green-700">{validCount} Valid rows</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <div className="font-medium text-yellow-700">{warningCount} Rows with warnings</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <div className="font-medium text-red-700">{errorCount} Rows with errors</div>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Pills */}
            {validationResults.length > 0 && (
              <div className="flex gap-2">
                <Badge 
                  variant={viewFilter === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setViewFilter('all')}
                >
                  All ({validationResults.length})
                </Badge>
                <Badge 
                  variant={viewFilter === 'valid' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setViewFilter('valid')}
                >
                  Valid ({validCount})
                </Badge>
                <Badge 
                  variant={viewFilter === 'errors' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setViewFilter('errors')}
                >
                  Errors ({errorCount})
                </Badge>
              </div>
            )}

            {/* Preview Table */}
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredResults.length > 0 ? (
              <div className="rounded-md border max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      {templateColumns.map((column) => (
                        <TableHead key={column}>{column}</TableHead>
                      ))}
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.slice(0, 50).map((result, index) => (
                      <TableRow key={index} className={!result.isValid ? "bg-red-50" : ""}>
                        <TableCell>{result.rowIndex + 1}</TableCell>
                        {templateColumns.map((column) => (
                          <TableCell key={column}>
                            {result.row[column as keyof CSVRow] || "-"}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="space-y-1">
                            {result.errors.map((error, i) => (
                              <Badge key={i} variant="destructive" className="text-xs">
                                {error}
                              </Badge>
                            ))}
                            {result.warnings.map((warning, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {warning}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : csvData.length > 0 ? (
              <Alert>
                <AlertDescription>
                  No rows match the current filter.
                </AlertDescription>
              </Alert>
            ) : null}

            {/* Safety Switches and Import Button */}
            {validCount > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="createMissingClients" className="text-sm font-medium">
                      Create missing clients automatically
                    </Label>
                    <Switch 
                      id="createMissingClients"
                      checked={createMissingClients}
                      onCheckedChange={setCreateMissingClients}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allowUpdates" className="text-sm font-medium">
                      Allow update if invoice exists (match by Invoice Number)
                    </Label>
                    <Switch 
                      id="allowUpdates"
                      checked={allowUpdates}
                      onCheckedChange={setAllowUpdates}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleImport} 
                  disabled={importing || validCount === 0 || errorCount > 0}
                  className="w-full"
                  size="lg"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? "Importing..." : `Import ${validCount} Valid Rows`}
                </Button>
                
                {errorCount > 0 && (
                  <Alert className="bg-red-50 border-red-200">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="text-red-700">
                      Cannot import while there are error rows. Please fix all errors first.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ImportInvoices;