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
  { value: "Inter",       label: "Inter",       sample: "Clean & modern" },
  { value: "Roboto",      label: "Roboto",      sample: "Neutral & versatile" },
  { value: "Open Sans",   label: "Open Sans",   sample: "Friendly & readable" },
  { value: "Montserrat",  label: "Montserrat",  sample: "Bold & geometric" },
  { value: "Lato",        label: "Lato",        sample: "Elegant & balanced" },
  { value: "Poppins",     label: "Poppins",     sample: "Rounded & contemporary" },
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
