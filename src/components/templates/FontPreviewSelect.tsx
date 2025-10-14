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
  { value: "Inter", label: "Inter", style: "font-sans" },
  { value: "Roboto", label: "Roboto", style: "font-sans" },
  { value: "Open Sans", label: "Open Sans", style: "font-sans" },
  { value: "Montserrat", label: "Montserrat", style: "font-sans" },
  { value: "Lato", label: "Lato", style: "font-sans" },
  { value: "Poppins", label: "Poppins", style: "font-sans" },
];

export function FontPreviewSelect({ value, onChange }: FontPreviewSelectProps) {
  return (
    <div className="space-y-2">
      <Label>Font Family</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fontFamilies.map((font) => (
            <SelectItem
              key={font.value}
              value={font.value}
              style={{ fontFamily: font.value }}
            >
              <div className="flex items-center justify-between w-full">
                <span style={{ fontFamily: font.value }}>{font.label}</span>
                <span className="text-xs text-muted-foreground ml-4" style={{ fontFamily: font.value }}>
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
