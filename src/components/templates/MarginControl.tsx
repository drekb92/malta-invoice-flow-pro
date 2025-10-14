import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Maximize2 } from "lucide-react";

interface MarginControlProps {
  top: number;
  right: number;
  bottom: number;
  left: number;
  onChange: (margins: { top: number; right: number; bottom: number; left: number }) => void;
}

export function MarginControl({ top, right, bottom, left, onChange }: MarginControlProps) {
  const handleChange = (side: 'top' | 'right' | 'bottom' | 'left', value: string) => {
    const numValue = parseInt(value) || 0;
    onChange({
      top: side === 'top' ? numValue : top,
      right: side === 'right' ? numValue : right,
      bottom: side === 'bottom' ? numValue : bottom,
      left: side === 'left' ? numValue : left,
    });
  };

  const handleUniformChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    onChange({
      top: numValue,
      right: numValue,
      bottom: numValue,
      left: numValue,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Margins (mm)</Label>
        <div className="flex items-center gap-2">
          <Maximize2 className="h-3 w-3 text-muted-foreground" />
          <Input
            type="number"
            min="0"
            max="50"
            className="w-16 h-7 text-xs"
            placeholder="All"
            onChange={(e) => handleUniformChange(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Top</Label>
          <Input
            type="number"
            min="0"
            max="50"
            value={top}
            onChange={(e) => handleChange('top', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Right</Label>
          <Input
            type="number"
            min="0"
            max="50"
            value={right}
            onChange={(e) => handleChange('right', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Bottom</Label>
          <Input
            type="number"
            min="0"
            max="50"
            value={bottom}
            onChange={(e) => handleChange('bottom', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Left</Label>
          <Input
            type="number"
            min="0"
            max="50"
            value={left}
            onChange={(e) => handleChange('left', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="relative h-24 border-2 border-dashed border-border rounded-lg bg-muted/20">
        <div
          className="absolute bg-primary/10 border border-primary/30 rounded transition-all"
          style={{
            top: `${(top / 50) * 100}%`,
            right: `${(right / 50) * 100}%`,
            bottom: `${(bottom / 50) * 100}%`,
            left: `${(left / 50) * 100}%`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Content Area</span>
        </div>
      </div>
    </div>
  );
}
