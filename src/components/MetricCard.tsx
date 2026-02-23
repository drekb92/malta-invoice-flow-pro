import { LucideIcon, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ColorScheme = "amber" | "emerald" | "blue" | "slate";

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  subtitle?: string;
  onClick?: () => void;
  viewAllLabel?: string;
  colorScheme?: ColorScheme;
  urgent?: boolean;
}

const schemeStyles: Record<ColorScheme, { iconBg: string; iconText: string; cardBorder?: string; cardBg?: string }> = {
  amber: {
    iconBg: "bg-amber-100",
    iconText: "text-amber-600",
    cardBorder: "border-amber-200",
    cardBg: "bg-amber-50/40",
  },
  emerald: {
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-600",
  },
  blue: {
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
  },
  slate: {
    iconBg: "bg-slate-100",
    iconText: "text-slate-600",
  },
};

export function MetricCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  subtitle,
  onClick,
  viewAllLabel = "View all",
  colorScheme = "slate",
  urgent = false,
}: MetricCardProps) {
  const changeColor = {
    positive: "text-emerald-600",
    negative: "text-amber-600",
    neutral: "text-muted-foreground",
  }[changeType];

  const scheme = schemeStyles[colorScheme];

  // Urgent cards (Outstanding with balance) get a left accent border + tinted bg
  const urgentStyles = urgent ? "border-l-4 border-l-amber-400 bg-amber-50/40" : "";

  return (
    <Card
      className={`h-[130px] ${urgentStyles} ${
        onClick ? "cursor-pointer hover:shadow-md transition-all hover:border-primary/20" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${scheme.iconBg}`}>
                <Icon className={`h-4 w-4 ${scheme.iconText}`} />
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
            </div>
            <p className="text-2xl font-semibold tabular-nums mt-2">{value}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className={`text-xs ${changeColor}`}>{change}</p>
              {subtitle && <span className="text-[10px] text-muted-foreground/70">· {subtitle}</span>}
            </div>
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
