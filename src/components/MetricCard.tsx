import { LucideIcon, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  onClick?: () => void;
  viewAllLabel?: string;
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  changeType, 
  icon: Icon, 
  onClick,
  viewAllLabel = "View all",
}: MetricCardProps) {
  const changeColor = {
    positive: "text-emerald-600",
    negative: "text-amber-600",
    neutral: "text-muted-foreground",
  }[changeType];

  return (
    <Card 
      className={`h-[130px] ${onClick ? "cursor-pointer hover:shadow-md transition-all hover:border-primary/20" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                {title}
              </p>
            </div>
            <p className="text-2xl font-semibold tabular-nums mt-2">{value}</p>
            <p className={`text-xs ${changeColor} mt-1`}>{change}</p>
          </div>
          {onClick && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-muted-foreground hover:text-foreground h-6 px-2 -mr-2 -mt-1"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              {viewAllLabel}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
