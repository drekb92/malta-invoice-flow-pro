import { useEffect } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Reads the user's saved theme preference from user_preferences
 * and applies it via next-themes on login / mount.
 * Also keeps next-themes in sync when the Settings page saves a new value.
 */
export function useThemeSync() {
  const { setTheme } = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const loadTheme = async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("theme")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.theme) {
        // Map legacy "system" to "light"
        const resolved = data.theme === "system" ? "light" : data.theme;
        setTheme(resolved); // "light" | "dark"
      }
    };

    loadTheme();
  }, [user, setTheme]);
}
