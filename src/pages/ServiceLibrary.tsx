import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Service {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  vat_rate: number;
  unit: string;
  category: string | null;
  usage_count: number;
  is_active: boolean;
}

const categories = [
  { value: "professional_services", label: "Professional Services" },
  { value: "goods", label: "Goods" },
  { value: "rental", label: "Rental Services" },
  { value: "consulting", label: "Consulting" },
  { value: "construction", label: "Construction" },
  { value: "other", label: "Other" },
];

export default function ServiceLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    default_price: "",
    vat_rate: "0.18",
    unit: "service",
    category: "professional_services",
  });

  useEffect(() => {
    fetchServices();
  }, [user]);

  const fetchServices = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("usage_count", { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error",
        description: "Failed to load services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const serviceData = {
        user_id: user.id,
        name: formData.name,
        description: formData.description || null,
        default_price: parseFloat(formData.default_price),
        vat_rate: parseFloat(formData.vat_rate),
        unit: formData.unit,
        category: formData.category,
      };

      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq("id", editingService.id);

        if (error) throw error;
        toast({ title: "Service updated successfully" });
      } else {
        const { error } = await supabase
          .from("services")
          .insert([serviceData]);

        if (error) throw error;
        toast({ title: "Service added successfully" });
      }

      setDialogOpen(false);
      resetForm();
      fetchServices();
    } catch (error) {
      console.error("Error saving service:", error);
      toast({
        title: "Error",
        description: "Failed to save service",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      default_price: service.default_price.toString(),
      vat_rate: service.vat_rate.toString(),
      unit: service.unit,
      category: service.category || "professional_services",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Service removed" });
      fetchServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({
        title: "Error",
        description: "Failed to remove service",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingService(null);
    setFormData({
      name: "",
      description: "",
      default_price: "",
      vat_rate: "0.18",
      unit: "service",
      category: "professional_services",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-MT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8" />
              Service Library
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your common services and products
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? "Edit Service" : "Add New Service"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Service Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="default_price">Default Price (€) *</Label>
                    <Input
                      id="default_price"
                      type="number"
                      step="0.01"
                      value={formData.default_price}
                      onChange={(e) =>
                        setFormData({ ...formData, default_price: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="vat_rate">VAT Rate *</Label>
                    <Select
                      value={formData.vat_rate}
                      onValueChange={(value) =>
                        setFormData({ ...formData, vat_rate: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.18">18% (Standard)</SelectItem>
                        <SelectItem value="0.07">7% (Accommodation)</SelectItem>
                        <SelectItem value="0.05">5% (Reduced)</SelectItem>
                        <SelectItem value="0">0% (Zero-rated)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value })
                      }
                      placeholder="e.g., hour, day, item"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingService ? "Update" : "Add"} Service
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Services</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : services.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No services yet. Add your first service to get started!
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>VAT</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{service.name}</p>
                          {service.description && (
                            <p className="text-sm text-muted-foreground">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categories.find((c) => c.value === service.category)?.label || service.category}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(service.default_price)}</TableCell>
                      <TableCell>{(service.vat_rate * 100).toFixed(0)}%</TableCell>
                      <TableCell>{service.unit}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{service.usage_count}x</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(service)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(service.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
