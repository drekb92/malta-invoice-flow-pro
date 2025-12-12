import { useState } from "react";
import { format } from "date-fns";
import { FileText, CheckCircle, Receipt, Banknote, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { TimelineEvent } from "./types";
import { formatCurrency } from "./utils";

interface TransactionActivityTimelineProps {
  events: TimelineEvent[];
  defaultOpen?: boolean;
}

const getTimelineIcon = (eventType: TimelineEvent["type"]) => {
  switch (eventType) {
    case "created":
    case "issued":
      return <FileText className="h-3 w-3" />;
    case "credit_note":
      return <Receipt className="h-3 w-3" />;
    case "payment":
    case "paid":
      return <Banknote className="h-3 w-3" />;
    case "sent":
    case "accepted":
    case "converted":
      return <CheckCircle className="h-3 w-3" />;
  }
};

const getTimelineColor = (eventType: TimelineEvent["type"]) => {
  switch (eventType) {
    case "created":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
    case "issued":
    case "sent":
      return "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300";
    case "credit_note":
      return "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300";
    case "payment":
    case "paid":
    case "accepted":
      return "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300";
    case "converted":
      return "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300";
  }
};

export const TransactionActivityTimeline = ({ 
  events, 
  defaultOpen = false 
}: TransactionActivityTimelineProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (events.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-5">
      <CollapsibleTrigger className="flex items-center justify-between w-full group py-1">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Activity Timeline
        </h3>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="relative bg-card border border-border/60 rounded-lg p-4 shadow-sm">
          <div className="absolute left-[25px] top-6 bottom-6 w-px bg-border/60" />
          <div className="space-y-3">
            {events.map(event => (
              <div key={event.id} className="flex items-start gap-3 relative">
                <div
                  className={`relative z-10 flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${getTimelineColor(event.type)}`}
                >
                  {getTimelineIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground truncate">{event.title}</span>
                    {event.amount && (
                      <span
                        className={`text-[11px] font-medium shrink-0 ${
                          event.type === "credit_note" ? "text-destructive" : "text-green-600"
                        }`}
                      >
                        {event.type === "credit_note" ? "–" : ""}
                        {formatCurrency(event.amount)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {format(new Date(event.date), "dd/MM/yyyy HH:mm")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
