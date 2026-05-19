import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FontPreviewSelectProps {
  value: string;
  onChange: (value: string) => void;
}

const fontFamilies = [
  { value: "Figtree",     label: "Figtree",     sample: "Warm & precise" },
  { value: "Archivo",     label: "Archivo",     sample: "Document-native" },
  { value: "Barlow",      label: "Barlow",      sample: "Editorial & open" },
  { value: "Sora",        label: "Sora",        sample: "Geometric & precise" },
  { value: "Raleway",     label: "Raleway",     sample: "Refined & airy" },
  { value: "Albert Sans", label: "Albert Sans", sample: "Swiss clean" },
];

export function FontPreviewSelect({ value, onChange }: FontPreviewSelectProps) {
  const selected = fontFamilies.find((f) => f.value === value) ?? fontFamilies[0];

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Font Family</Label>

      {/* Current selection preview */}
      <div
        className="p-3 rounded-lg border border-border bg-muted/30"
        style={{ fontFamily: selected.value }}
      >
        <p className="text-base font-semibold">{selected.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">AaBbCc 0123 — {selected.sample}</p>
      </div>

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fontFamilies.map((font) => (
            <SelectItem key={font.value} value={font.value}>
              <div className="flex items-center justify-between w-full gap-6 py-0.5">
                <span style={{ fontFamily: font.value }} className="font-medium">
                  {font.label}
                </span>
                <span
                  style={{ fontFamily: font.value }}
                  className="text-xs text-muted-foreground"
                >
                  AaBbCc
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
