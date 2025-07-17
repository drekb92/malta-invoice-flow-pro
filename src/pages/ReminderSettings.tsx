
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save, Mail, MessageCircle } from "lucide-react";

const ReminderSettings = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Reminder Settings</h1>
                <p className="text-muted-foreground">
                  Configure automated payment reminders and notifications
                </p>
              </div>
              <Button>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        </header>

        <main className="p-6">
          <div className="max-w-4xl space-y-6">
            {/* Email Reminders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  Email Reminders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Enable Email Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Send automated reminder emails to customers
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Before Due Date</Label>
                    <div className="flex items-center space-x-2">
                      <Input type="number" defaultValue="3" className="w-20" />
                      <span className="text-sm text-muted-foreground">days before</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>On Due Date</Label>
                    <div className="flex items-center space-x-2">
                      <Switch defaultChecked />
                      <span className="text-sm text-muted-foreground">Send reminder</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>After Due Date</Label>
                    <div className="flex items-center space-x-2">
                      <Input type="number" defaultValue="7" className="w-20" />
                      <span className="text-sm text-muted-foreground">days after</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reminder Frequency</Label>
                  <Select defaultValue="weekly">
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Email Template</Label>
                  <Textarea
                    placeholder="Dear {customer_name}, this is a friendly reminder that invoice {invoice_number} for {amount} is due on {due_date}..."
                    className="min-h-24"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use variables: {"{customer_name}"}, {"{invoice_number}"}, {"{amount}"}, {"{due_date}"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* WhatsApp Reminders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  WhatsApp Reminders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Enable WhatsApp Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Send automated WhatsApp messages to customers
                    </p>
                  </div>
                  <Switch />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Before Due Date</Label>
                    <div className="flex items-center space-x-2">
                      <Input type="number" defaultValue="1" className="w-20" />
                      <span className="text-sm text-muted-foreground">days before</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>On Due Date</Label>
                    <div className="flex items-center space-x-2">
                      <Switch />
                      <span className="text-sm text-muted-foreground">Send reminder</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>After Due Date</Label>
                    <div className="flex items-center space-x-2">
                      <Input type="number" defaultValue="3" className="w-20" />
                      <span className="text-sm text-muted-foreground">days after</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>WhatsApp Template</Label>
                  <Textarea
                    placeholder="Hi {customer_name}, friendly reminder: Invoice {invoice_number} for {amount} is due {due_date}. Thank you!"
                    className="min-h-20"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Advanced Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Stop Reminders After Payment</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically stop sending reminders when invoice is paid
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Maximum Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Stop sending reminders after this many attempts
                    </p>
                  </div>
                  <Input type="number" defaultValue="5" className="w-20" />
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReminderSettings;
