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
  /** Tailwind bg + text classes for the icon badge, e.g. "bg-blue-100 text-blue-600" */
  iconBg?: string;
}

export function TemplateControlSection({
  title,
  icon,
  children,
  defaultOpen = true,
  iconBg = "bg-muted text-muted-foreground",
}: TemplateControlSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="border border-border rounded-lg overflow-hidden">
      <CollapsibleTrigger className="group w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border p-4 space-y-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
