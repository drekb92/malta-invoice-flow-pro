import { useThemeSync } from "@/hooks/useThemeSync";

/** Invisible component that syncs the DB theme pref into next-themes */
export function ThemeSyncProvider() {
  useThemeSync();
  return null;
}
