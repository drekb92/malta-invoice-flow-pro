import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Save, Mail, AlertCircle, CheckCircle, Clock, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReminderSettings {
  id?: string;
  email_reminders_enabled: boolean;
  days_before_due: number;
  send_on_due_date: boolean;
  days_after_due_first: number;
  days_after_due_second: number;
  days_after_due_final: number;
  max_reminders: number;
  stop_after_payment: boolean;
  reminder_frequency: string;
}

interface ReminderTemplate {
  id: string;
  level: 'friendly' | 'firm' | 'final';
  subject: string;
  body: string;
}

const ReminderSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>({
    email_reminders_enabled: true,
    days_before_due: 3,
    send_on_due_date: true,
    days_after_due_first: 7,
    days_after_due_second: 14,
    days_after_due_final: 21,
    max_reminders: 5,
    stop_after_payment: true,
    reminder_frequency: 'weekly',
  });
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [hasResendKey, setHasResendKey] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings();
      loadTemplates();
      checkResendKey();
    }
  }, [user]);

  const checkResendKey = () => {
    // Check if Resend is configured - in production this would check the backend
    setHasResendKey(true);
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading reminder settings:', error);
      toast({
        title: "Error",
        description: "Failed to load reminder settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('reminder_templates')
        .select('*')
        .eq('user_id', user?.id)
        .order('level', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('reminder_settings')
        .upsert({
          ...settings,
          user_id: user?.id,
        });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Your reminder settings have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save reminder settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async (template: ReminderTemplate) => {
    try {
      const { error } = await supabase
        .from('reminder_templates')
        .update({
          subject: template.subject,
          body: template.body,
        })
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: "Template Saved",
        description: `${template.level} template has been updated.`,
      });

      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    }
  };

  const updateSetting = (key: keyof ReminderSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateTemplate = (id: string, field: 'subject' | 'body', value: string) => {
    setTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const getLevelBadge = (level: string) => {
    const badges = {
      friendly: { label: "Friendly", variant: "outline" as const, icon: Mail },
      firm: { label: "Firm", variant: "default" as const, icon: AlertCircle },
      final: { label: "Final Notice", variant: "destructive" as const, icon: AlertCircle },
    };
    return badges[level as keyof typeof badges] || badges.friendly;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="md:ml-64 p-6">
          <p>Loading reminder settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Payment Reminders</h1>
                <p className="text-muted-foreground">
                  Configure automated payment reminders with Malta business practices
                </p>
              </div>
              <Button onClick={handleSaveSettings} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        </header>

        <main className="p-6">
          {!hasResendKey && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Email reminders require Resend configuration. Make sure your RESEND_API_KEY is set up.
              </AlertDescription>
            </Alert>
          )}

          <div className="max-w-4xl space-y-6">
            {/* Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Reminder Schedule
                </CardTitle>
                <CardDescription>
                  Configure when payment reminders are sent based on invoice due dates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Enable Email Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically send payment reminders to customers
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_reminders_enabled}
                    onCheckedChange={(checked) => updateSetting('email_reminders_enabled', checked)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Friendly Reminder (Before Due)</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={settings.days_before_due}
                        onChange={(e) => updateSetting('days_before_due', parseInt(e.target.value))}
                        className="w-20"
                        min="0"
                      />
                      <span className="text-sm text-muted-foreground">days before</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>First Follow-up (After Due)</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={settings.days_after_due_first}
                        onChange={(e) => updateSetting('days_after_due_first', parseInt(e.target.value))}
                        className="w-20"
                        min="0"
                      />
                      <span className="text-sm text-muted-foreground">days after</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Second Follow-up (Firm)</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={settings.days_after_due_second}
                        onChange={(e) => updateSetting('days_after_due_second', parseInt(e.target.value))}
                        className="w-20"
                        min="0"
                      />
                      <span className="text-sm text-muted-foreground">days after</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Final Notice (Last Warning)</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      value={settings.days_after_due_final}
                      onChange={(e) => updateSetting('days_after_due_final', parseInt(e.target.value))}
                      className="w-20"
                      min="0"
                    />
                    <span className="text-sm text-muted-foreground">days after due date</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Final notice includes warnings about late payment interest per Maltese law
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <Label className="text-base font-medium">Stop After Payment</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically stop reminders when invoice is marked as paid
                    </p>
                  </div>
                  <Switch
                    checked={settings.stop_after_payment}
                    onCheckedChange={(checked) => updateSetting('stop_after_payment', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Maximum Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Stop sending reminders after this many attempts
                    </p>
                  </div>
                  <Input
                    type="number"
                    value={settings.max_reminders}
                    onChange={(e) => updateSetting('max_reminders', parseInt(e.target.value))}
                    className="w-20"
                    min="1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Email Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  Email Templates
                </CardTitle>
                <CardDescription>
                  Customize email templates for each escalation level (Malta business tone)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="friendly" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    {templates.map((template) => {
                      const badge = getLevelBadge(template.level);
                      return (
                        <TabsTrigger key={template.level} value={template.level}>
                          <badge.icon className="h-4 w-4 mr-2" />
                          {badge.label}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {templates.map((template) => {
                    const badge = getLevelBadge(template.level);
                    return (
                      <TabsContent key={template.level} value={template.level} className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {template.level === 'friendly' && 'Polite reminder before/on due date'}
                            {template.level === 'firm' && 'Professional but firm tone for overdue payments'}
                            {template.level === 'final' && 'Legal language with Malta law references'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <Label>Email Subject</Label>
                          <Input
                            value={template.subject}
                            onChange={(e) => updateTemplate(template.id, 'subject', e.target.value)}
                            placeholder="Subject line..."
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Email Body</Label>
                          <Textarea
                            value={template.body}
                            onChange={(e) => updateTemplate(template.id, 'body', e.target.value)}
                            className="min-h-64 font-mono text-sm"
                            placeholder="Email content..."
                          />
                          <p className="text-xs text-muted-foreground">
                            Available variables: {"{customer_name}"}, {"{invoice_number}"}, {"{amount}"}, 
                            {" {due_date}"}, {"{days_overdue}"}, {"{company_name}"}, {"{company_phone}"}, 
                            {" {company_email}"}, {"{payment_terms}"}
                          </p>
                        </div>

                        <Button 
                          onClick={() => handleSaveTemplate(template)}
                          variant="outline"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save Template
                        </Button>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>

            {/* Malta Business Practices Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Malta Business Practices
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong>Escalation Timeline:</strong> The default settings follow Malta business norms - 
                  friendly reminder before due date, first follow-up after 7 days, firm reminder after 14 days, 
                  and final notice after 21 days.
                </p>
                <p>
                  <strong>Late Payment Interest:</strong> Final notices reference the right to charge interest 
                  on late payments as per Maltese commercial law (typically 8% per annum plus statutory compensation).
                </p>
                <p>
                  <strong>Professional Tone:</strong> Templates maintain professionalism throughout escalation 
                  levels, suitable for Malta's close-knit business community.
                </p>
                <p>
                  <strong>Legal Compliance:</strong> Final notice templates include language appropriate for 
                  potential debt collection or legal proceedings in Malta.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReminderSettings;
