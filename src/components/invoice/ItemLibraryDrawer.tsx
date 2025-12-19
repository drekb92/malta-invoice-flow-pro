import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Clock, Zap, Package } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface ServiceTemplate {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  vat_rate: number;
  unit: string;
  category: string | null;
  usage_count: number;
}

interface RecentItem {
  description: string;
  unit_price: number;
  vat_rate: number;
  unit: string;
  usage_count: number;
}

interface ItemLibraryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceTemplates: ServiceTemplate[];
  recentItems: RecentItem[];
  onAddTemplate: (template: ServiceTemplate) => void;
  onAddRecentItem: (item: RecentItem) => void;
}

export const ItemLibraryDrawer = ({
  open,
  onOpenChange,
  serviceTemplates,
  recentItems,
  onAddTemplate,
  onAddRecentItem,
}: ItemLibraryDrawerProps) => {
  const [activeTab, setActiveTab] = useState("templates");

  const handleAddTemplate = (template: ServiceTemplate) => {
    onAddTemplate(template);
  };

  const handleAddRecentItem = (item: RecentItem) => {
    onAddRecentItem(item);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Item Library
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-4">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {serviceTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No templates yet</p>
                  <p className="text-sm mt-1">
                    Create templates in the Service Library
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {serviceTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {template.name}
                          </span>
                          {template.category && (
                            <Badge variant="secondary" className="text-xs">
                              {template.category}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>€{formatNumber(template.default_price, 2)}</span>
                          <span>•</span>
                          <span>VAT {(template.vat_rate * 100).toFixed(0)}%</span>
                          {template.usage_count > 0 && (
                            <>
                              <span>•</span>
                              <span>Used {template.usage_count}x</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAddTemplate(template)}
                        className="ml-2 shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="recent" className="mt-4">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {recentItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No recent items</p>
                  <p className="text-sm mt-1">
                    Items you frequently use will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {recentItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm block truncate">
                          {item.description}
                        </span>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>€{formatNumber(item.unit_price, 2)}</span>
                          <span>•</span>
                          <span>VAT {(item.vat_rate * 100).toFixed(0)}%</span>
                          <span>•</span>
                          <span>Used {item.usage_count}x</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAddRecentItem(item)}
                        className="ml-2 shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
