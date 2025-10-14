import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface TemplateControlSectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function TemplateControlSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: TemplateControlSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="border border-border rounded-lg overflow-hidden">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="p-4 space-y-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
