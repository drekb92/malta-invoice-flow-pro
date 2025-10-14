import { Monitor, Printer, Smartphone, SplitSquareVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type PreviewMode = 'desktop' | 'print' | 'mobile' | 'comparison';

interface PreviewModeSelectorProps {
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
}

export function PreviewModeSelector({ mode, onModeChange }: PreviewModeSelectorProps) {
  const modes = [
    { id: 'desktop' as const, icon: Monitor, label: 'Desktop Preview' },
    { id: 'print' as const, icon: Printer, label: 'Print Preview (A4)' },
    { id: 'mobile' as const, icon: Smartphone, label: 'Mobile Preview' },
    { id: 'comparison' as const, icon: SplitSquareVertical, label: 'Side-by-Side' },
  ];

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        {modes.map((m) => (
          <Tooltip key={m.id}>
            <TooltipTrigger asChild>
              <Button
                variant={mode === m.id ? "default" : "ghost"}
                size="sm"
                onClick={() => onModeChange(m.id)}
                className="h-8 w-8 p-0"
              >
                <m.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{m.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
