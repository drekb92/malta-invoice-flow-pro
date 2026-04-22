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

const schemeStyles: Record<
  ColorScheme,
  { iconBg: string; iconText: string; cardBorder: string; cardBg?: string }
> = {
  amber: {
    iconBg: "bg-amber-100",
    iconText: "text-amber-600",
    cardBorder: "border border-amber-200/70",
    cardBg: "bg-amber-50/40",
  },
  emerald: {
    iconBg: "bg-emerald-100",
    iconText: "text-emerald-600",
    cardBorder: "border border-emerald-200/60",
    cardBg: "bg-emerald-50/30",
  },
  blue: {
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    cardBorder: "border border-blue-200/60",
    cardBg: "bg-blue-50/25",
  },
  slate: {
    iconBg: "bg-slate-100",
    iconText: "text-slate-500",
    cardBorder: "border border-border",
    cardBg: undefined,
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

  return (
    <Card
      className={`min-h-[140px] ${scheme.cardBorder} ${scheme.cardBg ?? ""} ${
        onClick ? "cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-150" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-5 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${scheme.iconBg}`}>
                <Icon className={`h-5 w-5 ${scheme.iconText}`} />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">{title}</p>
            </div>
            <p className="text-3xl font-bold tabular-nums mt-1 tracking-tight">{value}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <p className={`text-xs font-medium ${changeColor}`}>{change}</p>
              {subtitle && <span className="text-[10px] text-muted-foreground/60">· {subtitle}</span>}
            </div>
          </div>
          {onClick && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground h-6 px-2 -mr-1 -mt-1 shrink-0"
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
