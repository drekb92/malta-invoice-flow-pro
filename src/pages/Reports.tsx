
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, TrendingUp, Users, Euro } from "lucide-react";

const Reports = () => {
  const agingData = [
    {
      customer: "Acme Corporation",
      "0-30": "€1,200.00",
      "31-60": "€0.00",
      "61-90": "€0.00",
      "90+": "€0.00",
      total: "€1,200.00",
    },
    {
      customer: "Tech Solutions Ltd",
      "0-30": "€0.00",
      "31-60": "€2,450.00",
      "61-90": "€0.00",
      "90+": "€0.00",
      total: "€2,450.00",
    },
    {
      customer: "Global Enterprises",
      "0-30": "€0.00",
      "31-60": "€0.00",
      "61-90": "€0.00",
      "90+": "€3,750.00",
      total: "€3,750.00",
    },
    {
      customer: "Local Business",
      "0-30": "€850.00",
      "31-60": "€0.00",
      "61-90": "€0.00",
      "90+": "€0.00",
      total: "€850.00",
    },
  ];

  const totals = {
    "0-30": "€2,050.00",
    "31-60": "€2,450.00",
    "61-90": "€0.00",
    "90+": "€3,750.00",
    total: "€8,250.00",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Reports</h1>
                <p className="text-muted-foreground">
                  Financial reports and analytics for your receivables
                </p>
              </div>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </header>

        <main className="p-6">
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">0-30 Days</p>
                      <p className="text-2xl font-bold text-green-600">€2,050</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">31-60 Days</p>
                      <p className="text-2xl font-bold text-yellow-600">€2,450</p>
                    </div>
                    <Euro className="h-8 w-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">61-90 Days</p>
                      <p className="text-2xl font-bold text-orange-600">€0</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">90+ Days</p>
                      <p className="text-2xl font-bold text-red-600">€3,750</p>
                    </div>
                    <Users className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Aging Report Table */}
            <Card>
              <CardHeader>
                <CardTitle>Receivables Aging Report</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">0-30 Days</TableHead>
                      <TableHead className="text-right">31-60 Days</TableHead>
                      <TableHead className="text-right">61-90 Days</TableHead>
                      <TableHead className="text-right">90+ Days</TableHead>
                      <TableHead className="text-right font-semibold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agingData.map((row) => (
                      <TableRow key={row.customer}>
                        <TableCell className="font-medium">{row.customer}</TableCell>
                        <TableCell className="text-right text-green-600">{row["0-30"]}</TableCell>
                        <TableCell className="text-right text-yellow-600">{row["31-60"]}</TableCell>
                        <TableCell className="text-right text-orange-600">{row["61-90"]}</TableCell>
                        <TableCell className="text-right text-red-600">{row["90+"]}</TableCell>
                        <TableCell className="text-right font-semibold">{row.total}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 font-semibold bg-muted/50">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right text-green-600">{totals["0-30"]}</TableCell>
                      <TableCell className="text-right text-yellow-600">{totals["31-60"]}</TableCell>
                      <TableCell className="text-right text-orange-600">{totals["61-90"]}</TableCell>
                      <TableCell className="text-right text-red-600">{totals["90+"]}</TableCell>
                      <TableCell className="text-right font-bold">{totals.total}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Reports;
