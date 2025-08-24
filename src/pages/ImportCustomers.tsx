import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Upload, CheckCircle, AlertCircle, XCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface ParsedRow {
  client_type?: string;
  business_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  vat_status?: string;
  vat_number?: string;
  payment_terms?: string;
  notes?: string;
  date_added?: string;
  rowIndex: number;
  validation: {
    isValid: boolean;
    hasWarning: boolean;
    hasError: boolean;
    messages: string[];
    status: 'valid' | 'warning' | 'error' | 'duplicate-in-file' | 'potential-update';
  };
}

interface ImportResult {
  email: string;
  vat_number?: string;
  action: 'created' | 'updated' | 'skipped';
  message: string;
}

const ImportCustomers: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [createMissing, setCreateMissing] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [skipErrors, setSkipErrors] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const validationCounts = {
    valid: parsedData.filter(row => row.validation.status === 'valid').length,
    warnings: parsedData.filter(row => row.validation.hasWarning && !row.validation.hasError).length,
    errors: parsedData.filter(row => row.validation.hasError).length,
  };

  const downloadTemplate = () => {
    const headers = [
      "client_type",
      "business_name", 
      "name",
      "email",
      "phone",
      "address",
      "vat_status",
      "vat_number",
      "payment_terms",
      "notes",
      "date_added"
    ];

    const sampleRows = [
      [
        "Business",
        "ACME Ltd",
        "Anna Sultana",
        "anna@acme.com",
        "+35699000000",
        "12 Triq il-Marsa, Il-Marsa, Malta",
        "Registered",
        "MT12345678",
        "Net 30",
        "Key account",
        "2025-08-16"
      ],
      [
        "Individual",
        "",
        "Derek Borg", 
        "derek@example.com",
        "+35698111222",
        "45 Triq San Pawl, Naxxar, Malta",
        "Not Registered",
        "",
        "Net 15",
        "",
        "2025-08-16"
      ]
    ];

    const csvContent = [
      headers.join(","),
      ...sampleRows.map(row => 
        row.map(field => `"${field.replace(/"/g, '""')}"`).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "clients_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Template Downloaded",
      description: "CSV template has been downloaded to your device",
    });
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateRow = async (row: any, index: number, allRows: any[]): Promise<ParsedRow> => {
    const messages: string[] = [];
    let hasError = false;
    let hasWarning = false;
    let status: ParsedRow['validation']['status'] = 'valid';

    // Normalize client_type
    const clientType = row.client_type?.toLowerCase();
    const normalizedClientType = clientType === 'business' ? 'Business' : 
                                clientType === 'individual' ? 'Individual' : 
                                !row.client_type ? 'Individual' : row.client_type;

    if (row.client_type && !['business', 'individual'].includes(clientType)) {
      messages.push("Invalid client_type. Must be 'Business' or 'Individual'");
      hasError = true;
    }

    // Business name requirement
    if (normalizedClientType === 'Business' && !row.business_name?.trim()) {
      messages.push("Business name is required for Business clients");
      hasError = true;
    }

    // Individual name requirement  
    if (normalizedClientType === 'Individual' && !row.name?.trim()) {
      messages.push("Name is required for Individual clients");
      hasError = true;
    }

    // Unique identifier requirement
    if (!row.email?.trim() && !row.vat_number?.trim()) {
      messages.push("At least one unique identifier required: email or VAT number");
      hasError = true;
    }

    // Email validation
    if (row.email?.trim() && !validateEmail(row.email.trim())) {
      messages.push("Invalid email format");
      hasError = true;
    }

    // VAT number validation
    if (row.vat_number?.trim() && row.vat_number.trim().length < 5) {
      messages.push("VAT number must be at least 5 characters");
      hasError = true;
    }

    // Check duplicates within file
    const currentEmail = row.email?.trim().toLowerCase();
    const currentVat = row.vat_number?.trim();
    
    const duplicateIndex = allRows.findIndex((otherRow, otherIndex) => {
      if (otherIndex >= index) return false; // Only check earlier rows
      const otherEmail = otherRow.email?.trim().toLowerCase();
      const otherVat = otherRow.vat_number?.trim();
      
      return (currentVat && otherVat && currentVat === otherVat) ||
             (currentEmail && otherEmail && currentEmail === otherEmail);
    });

    if (duplicateIndex >= 0) {
      messages.push(`Duplicate of row ${duplicateIndex + 2}`);
      hasError = true;
      status = 'duplicate-in-file';
    }

    // Check against database for potential updates
    if (!hasError && user) {
      try {
        const { data: existingCustomers } = await supabase
          .from('customers')
          .select('email, vat_number')
          .eq('user_id', user.id)
          .or(`email.eq.${currentEmail},vat_number.eq.${currentVat}`);

        if (existingCustomers && existingCustomers.length > 0) {
          messages.push("Matches existing customer");
          hasWarning = true;
          status = 'potential-update';
        }
      } catch (error) {
        console.error('Error checking existing customers:', error);
      }
    }

    return {
      client_type: normalizedClientType,
      business_name: row.business_name?.trim() || '',
      name: row.name?.trim() || '',
      email: row.email?.trim() || '',
      phone: row.phone?.trim() || '',
      address: row.address?.trim() || '',
      vat_status: row.vat_status?.trim() || '',
      vat_number: row.vat_number?.trim() || '',
      payment_terms: row.payment_terms?.trim() || 'Net 30',
      notes: row.notes?.trim() || '',
      date_added: row.date_added?.trim() || new Date().toISOString().split('T')[0],
      rowIndex: index,
      validation: {
        isValid: !hasError,
        hasWarning,
        hasError,
        messages,
        status: hasError ? 'error' : status
      }
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    
    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const validatedRows: ParsedRow[] = [];
        
        for (let i = 0; i < results.data.length; i++) {
          const validatedRow = await validateRow(results.data[i], i, results.data);
          validatedRows.push(validatedRow);
        }
        
        setParsedData(validatedRows);
        setShowResults(false);
      },
      error: (error) => {
        toast({
          title: "CSV Parse Error",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleImport = async () => {
    if (!user) return;

    setImporting(true);
    const results: ImportResult[] = [];
    
    const validRows = skipErrors ? 
      parsedData.filter(row => !row.validation.hasError) : 
      parsedData.filter(row => row.validation.isValid);

    try {
      for (const row of validRows) {
        const matchKey = row.vat_number || row.email;
        
        // Check for existing customer
        let existingCustomer = null;
        if (matchKey) {
          const { data } = await supabase
            .from('customers')
            .select('id, email, vat_number')
            .eq('user_id', user.id)
            .or(row.vat_number ? 
                `vat_number.eq.${row.vat_number}` : 
                `email.eq.${row.email}`)
            .maybeSingle();
          
          existingCustomer = data;
        }

        if (existingCustomer) {
          if (updateExisting) {
            // Update existing customer
            const updateData: any = { user_id: user.id };
            
            // Only update non-empty fields from CSV
            if (row.client_type) updateData.client_type = row.client_type;
            if (row.business_name) updateData.business_name = row.business_name;
            if (row.name) updateData.name = row.name;
            if (row.email) updateData.email = row.email;
            if (row.phone) updateData.phone = row.phone;
            if (row.address) updateData.address = row.address;
            if (row.vat_status) updateData.vat_status = row.vat_status;
            if (row.vat_number) updateData.vat_number = row.vat_number;
            if (row.payment_terms) updateData.payment_terms = row.payment_terms;
            if (row.notes) updateData.notes = row.notes;
            if (row.date_added) updateData.date_added = row.date_added;

            await supabase
              .from('customers')
              .update(updateData)
              .eq('id', existingCustomer.id);

            results.push({
              email: row.email || existingCustomer.email || '',
              vat_number: row.vat_number,
              action: 'updated',
              message: 'Customer updated successfully'
            });
          } else {
            results.push({
              email: row.email || existingCustomer.email || '',
              vat_number: row.vat_number,
              action: 'skipped',
              message: 'Customer already exists'
            });
          }
        } else {
          if (createMissing) {
            // Create new customer
            await supabase
              .from('customers')
              .insert({
                user_id: user.id,
                client_type: row.client_type,
                business_name: row.business_name || null,
                name: row.name,
                email: row.email || null,
                phone: row.phone || null,
                address: row.address || null,
                vat_status: row.vat_status || null,
                vat_number: row.vat_number || null,
                payment_terms: row.payment_terms,
                notes: row.notes || null,
                date_added: row.date_added || null
              });

            results.push({
              email: row.email,
              vat_number: row.vat_number,
              action: 'created',
              message: 'Customer created successfully'
            });
          } else {
            results.push({
              email: row.email,
              vat_number: row.vat_number,
              action: 'skipped',
              message: 'Auto-create disabled'
            });
          }
        }
      }

      const created = results.filter(r => r.action === 'created').length;
      const updated = results.filter(r => r.action === 'updated').length;
      const skipped = results.filter(r => r.action === 'skipped').length;

      toast({
        title: "Import Complete",
        description: `Imported ${results.length} rows (created ${created}, updated ${updated}, skipped ${skipped}).`,
      });

      setImportResults(results);
      setShowResults(true);

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Error",
        description: "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const canImport = parsedData.length > 0 && 
    (skipErrors || validationCounts.errors === 0);

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
            <h1 className="text-3xl font-bold tracking-tight">Import Clients</h1>
            <p className="text-muted-foreground">
              Upload and import customer data from a CSV file
            </p>
          </div>
        </div>

        {!showResults ? (
          <div className="space-y-6">
            {/* Template Download */}
            <Card>
              <CardHeader>
                <CardTitle>Download CSV Template</CardTitle>
                <CardDescription>
                  CSV must be UTF-8 and comma-separated. Dates in YYYY-MM-DD format.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={downloadTemplate} className="w-full md:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV Template
                </Button>
                <div className="mt-3 text-sm text-muted-foreground">
                  <strong>Template headers (exact order):</strong><br />
                  client_type, business_name, name, email, phone, address, vat_status, vat_number, payment_terms, notes, date_added
                </div>
              </CardContent>
            </Card>

            {/* Upload & Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Upload & Preview</CardTitle>
                <CardDescription>
                  Select your CSV file to preview and validate the data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="csv-upload">Select CSV File</Label>
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="cursor-pointer"
                  />
                </div>

                {parsedData.length > 0 && (
                  <>
                    {/* Validation Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2 p-3 rounded-lg bg-green-50 border border-green-200">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium">{validationCounts.valid} Valid</span>
                      </div>
                      <div className="flex items-center space-x-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        <span className="text-sm font-medium">{validationCounts.warnings} Warnings</span>
                      </div>
                      <div className="flex items-center space-x-2 p-3 rounded-lg bg-red-50 border border-red-200">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="text-sm font-medium">{validationCounts.errors} Errors</span>
                      </div>
                    </div>

                    {/* Import Settings */}
                    <Card className="bg-gray-50">
                      <CardHeader>
                        <CardTitle className="text-lg">Import Settings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="create-missing" className="flex flex-col space-y-1">
                            <span>Create missing clients automatically</span>
                            <span className="text-sm text-muted-foreground">Add new customers that don't exist in database</span>
                          </Label>
                          <Switch
                            id="create-missing"
                            checked={createMissing}
                            onCheckedChange={setCreateMissing}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="update-existing" className="flex flex-col space-y-1">
                            <span>Update existing clients when Email/VAT matches</span>
                            <span className="text-sm text-muted-foreground">Overwrite existing customer data with CSV data</span>
                          </Label>
                          <Switch
                            id="update-existing"
                            checked={updateExisting}
                            onCheckedChange={setUpdateExisting}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Label htmlFor="skip-errors" className="flex flex-col space-y-1">
                            <span>Skip rows with errors</span>
                            <span className="text-sm text-muted-foreground">Continue import even if some rows have validation errors</span>
                          </Label>
                          <Switch
                            id="skip-errors"
                            checked={skipErrors}
                            onCheckedChange={setSkipErrors}
                          />
                        </div>
                        
                        <Button 
                          onClick={handleImport}
                          disabled={!canImport || importing}
                          className="w-full"
                          size="lg"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {importing ? 'Importing...' : `Import ${parsedData.filter(row => skipErrors ? !row.validation.hasError : row.validation.isValid).length} Rows`}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Preview Table */}
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Row</TableHead>
                            <TableHead className="w-16">Status</TableHead>
                            <TableHead>Name / Business</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>VAT Number</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Messages</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedData.slice(0, 100).map((row, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono text-sm">{index + 2}</TableCell>
                              <TableCell>
                                {row.validation.hasError ? (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                ) : row.validation.hasWarning ? (
                                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                                ) : (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                )}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">
                                    {row.business_name || row.name}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {row.client_type}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{row.email}</TableCell>
                              <TableCell>{row.vat_number}</TableCell>
                              <TableCell>
                                <Badge variant={row.validation.status === 'potential-update' ? 'outline' : 'secondary'}>
                                  {row.validation.status.replace('-', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  {row.validation.messages.map((msg, msgIndex) => (
                                    <div key={msgIndex} className="text-sm text-muted-foreground">
                                      {msg}
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {parsedData.length > 100 && (
                        <div className="p-4 text-sm text-muted-foreground border-t text-center">
                          Showing first 100 of {parsedData.length} rows. All rows will be processed during import.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Results View */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Import Results</span>
              </CardTitle>
              <CardDescription>
                Import completed successfully. Here are the results:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>VAT Number</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>{result.email}</TableCell>
                        <TableCell>{result.vat_number || '-'}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              result.action === 'created' ? 'default' :
                              result.action === 'updated' ? 'secondary' :
                              'outline'
                            }
                          >
                            {result.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {result.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-center">
                <Button 
                  onClick={() => navigate('/customers')}
                  size="lg"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Go to Customers
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ImportCustomers;