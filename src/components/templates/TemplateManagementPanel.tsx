import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Copy, Download, Upload, Trash2, FileJson } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InvoiceTemplate {
  id: string;
  name: string;
  is_default: boolean;
  primary_color: string;
  accent_color: string;
  font_family: string;
  font_size: string;
  layout?: 'default' | 'cleanMinimal' | 'compact';
  header_layout?: 'default' | 'centered' | 'split';
  table_style?: 'default' | 'striped' | 'bordered' | 'minimal';
  totals_style?: 'default' | 'boxed' | 'highlighted';
  banking_visibility?: boolean;
  banking_style?: 'default' | 'boxed' | 'minimal';
  margin_top?: number;
  margin_right?: number;
  margin_bottom?: number;
  margin_left?: number;
}

interface TemplateManagementPanelProps {
  templates: InvoiceTemplate[];
  selectedTemplate: InvoiceTemplate | null;
  currentSettings: Partial<InvoiceTemplate>;
  userId: string;
  onTemplateCreated: () => void;
  onTemplateDeleted: () => void;
  onTemplateSelected: (template: InvoiceTemplate) => void;
}

export function TemplateManagementPanel({
  templates,
  selectedTemplate,
  currentSettings,
  userId,
  onTemplateCreated,
  onTemplateDeleted,
  onTemplateSelected,
}: TemplateManagementPanelProps) {
  const { toast } = useToast();
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a template name.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('invoice_templates')
        .insert([{
          name: newTemplateName,
          is_default: false,
          primary_color: '#26A65B',
          accent_color: '#1F2D3D',
          font_family: 'Inter',
          font_size: '14px',
          layout: 'default',
          header_layout: 'default',
          table_style: 'default',
          totals_style: 'default',
          banking_visibility: true,
          banking_style: 'default',
          margin_top: 20,
          margin_right: 20,
          margin_bottom: 20,
          margin_left: 20,
          user_id: userId,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Template created",
        description: `${newTemplateName} has been created successfully.`,
      });
      
      setNewTemplateName("");
      onTemplateCreated();
    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: "Creation failed",
        description: "Failed to create template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDuplicateTemplate = async () => {
    if (!selectedTemplate) return;

    setIsDuplicating(true);
    try {
      const { data, error } = await supabase
        .from('invoice_templates')
        .insert([{
          name: `${selectedTemplate.name} (Copy)`,
          is_default: false,
          primary_color: currentSettings.primary_color || selectedTemplate.primary_color,
          accent_color: currentSettings.accent_color || selectedTemplate.accent_color,
          font_family: currentSettings.font_family || selectedTemplate.font_family,
          font_size: currentSettings.font_size || selectedTemplate.font_size,
          layout: currentSettings.layout || selectedTemplate.layout,
          header_layout: currentSettings.header_layout || selectedTemplate.header_layout,
          table_style: currentSettings.table_style || selectedTemplate.table_style,
          totals_style: currentSettings.totals_style || selectedTemplate.totals_style,
          banking_visibility: currentSettings.banking_visibility ?? selectedTemplate.banking_visibility,
          banking_style: currentSettings.banking_style || selectedTemplate.banking_style,
          margin_top: currentSettings.margin_top || selectedTemplate.margin_top,
          margin_right: currentSettings.margin_right || selectedTemplate.margin_right,
          margin_bottom: currentSettings.margin_bottom || selectedTemplate.margin_bottom,
          margin_left: currentSettings.margin_left || selectedTemplate.margin_left,
          user_id: userId,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Template duplicated",
        description: `Copy of ${selectedTemplate.name} has been created.`,
      });
      
      onTemplateCreated();
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast({
        title: "Duplication failed",
        description: "Failed to duplicate template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate || selectedTemplate.is_default) {
      toast({
        title: "Cannot delete",
        description: "Cannot delete the default template.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('invoice_templates')
        .delete()
        .eq('id', selectedTemplate.id);

      if (error) throw error;

      toast({
        title: "Template deleted",
        description: `${selectedTemplate.name} has been deleted.`,
      });
      
      onTemplateDeleted();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Deletion failed",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportTemplate = () => {
    if (!selectedTemplate) return;

    const templateData = {
      ...currentSettings,
      name: selectedTemplate.name,
      version: "1.0",
      exported_at: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(templateData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedTemplate.name.replace(/\s+/g, '-').toLowerCase()}-template.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Template exported",
      description: "Template has been exported as JSON.",
    });
  };

  const handleImportTemplate = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);

      const { data, error } = await supabase
        .from('invoice_templates')
        .insert([{
          name: `${importedData.name || 'Imported'} (Imported)`,
          is_default: false,
          primary_color: importedData.primary_color || '#26A65B',
          accent_color: importedData.accent_color || '#1F2D3D',
          font_family: importedData.font_family || 'Inter',
          font_size: importedData.font_size || '14px',
          layout: importedData.layout || 'default',
          header_layout: importedData.header_layout || 'default',
          table_style: importedData.table_style || 'default',
          totals_style: importedData.totals_style || 'default',
          banking_visibility: importedData.banking_visibility ?? true,
          banking_style: importedData.banking_style || 'default',
          margin_top: importedData.margin_top || 20,
          margin_right: importedData.margin_right || 20,
          margin_bottom: importedData.margin_bottom || 20,
          margin_left: importedData.margin_left || 20,
          user_id: userId,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Template imported",
        description: "Template has been imported successfully.",
      });
      
      onTemplateCreated();
    } catch (error) {
      console.error('Error importing template:', error);
      toast({
        title: "Import failed",
        description: "Failed to import template. Please check the file format.",
        variant: "destructive",
      });
    }
    
    event.target.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Template Management</h3>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Template</DialogTitle>
                <DialogDescription>
                  Enter a name for your new invoice template.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    placeholder="e.g., Professional Blue"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateTemplate} disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create Template"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicateTemplate}
            disabled={!selectedTemplate || isDuplicating}
          >
            <Copy className="h-4 w-4 mr-1" />
            Duplicate
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportTemplate}
          disabled={!selectedTemplate}
          className="flex-1"
        >
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => document.getElementById('import-template')?.click()}
        >
          <Upload className="h-4 w-4 mr-1" />
          Import
        </Button>
        <input
          id="import-template"
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportTemplate}
        />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedTemplate || selectedTemplate.is_default}
              className="flex-1"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTemplate} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="text-xs text-muted-foreground">
        {templates.length} template{templates.length !== 1 ? 's' : ''} available
      </div>
    </div>
  );
}
