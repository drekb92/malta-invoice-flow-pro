import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_rate: number;
}

interface InvoiceLineItemsProps {
  lineItems: LineItem[];
  onLineItemsChange: (items: LineItem[]) => void;
}

export function InvoiceLineItems({ lineItems, onLineItemsChange }: InvoiceLineItemsProps) {
  const addLineItem = () => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      description: "",
      quantity: 1,
      unit: "service",
      unit_price: 0,
      vat_rate: 0.18,
    };
    onLineItemsChange([...lineItems, newItem]);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    const updatedItems = lineItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onLineItemsChange(updatedItems);
  };

  const removeLineItem = (id: string) => {
    onLineItemsChange(lineItems.filter(item => item.id !== id));
  };

  const calculateItemTotal = (item: LineItem) => {
    const subtotal = item.quantity * item.unit_price;
    const vat = subtotal * item.vat_rate;
    return subtotal + vat;
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const vatTotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price * item.vat_rate), 0);
    const grandTotal = subtotal + vatTotal;
    return { subtotal, vatTotal, grandTotal };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-base font-medium">Line Items</Label>
        <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
          <Plus className="h-4 w-4 mr-2" />
          Add Line Item
        </Button>
      </div>

      {lineItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No line items added. Click "Add Line Item" to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {lineItems.map((item, index) => (
            <div key={item.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Item {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLineItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label htmlFor={`description-${item.id}`}>Description *</Label>
                  <Input
                    id={`description-${item.id}`}
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                    placeholder="Service description"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor={`quantity-${item.id}`}>Quantity *</Label>
                  <Input
                    id={`quantity-${item.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor={`unit-${item.id}`}>Unit</Label>
                  <Select
                    value={item.unit}
                    onValueChange={(value) => updateLineItem(item.id, 'unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="pieces">Pieces</SelectItem>
                      <SelectItem value="kg">Kg</SelectItem>
                      <SelectItem value="m">Meters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor={`unit_price-${item.id}`}>Unit Price (€) *</Label>
                  <Input
                    id={`unit_price-${item.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor={`vat_rate-${item.id}`}>VAT Rate</Label>
                  <Select
                    value={item.vat_rate.toString()}
                    onValueChange={(value) => updateLineItem(item.id, 'vat_rate', parseFloat(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (Exempt)</SelectItem>
                      <SelectItem value="0.05">5%</SelectItem>
                      <SelectItem value="0.18">18% (Standard)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end text-sm text-muted-foreground">
                Item Total: €{calculateItemTotal(item).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {lineItems.length > 0 && (
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>€{totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>VAT Total:</span>
            <span>€{totals.vatTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-medium border-t pt-2">
            <span>Grand Total:</span>
            <span>€{totals.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}