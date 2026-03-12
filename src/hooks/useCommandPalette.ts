import { useState, useEffect, useCallback } from "react";

let globalOpen: ((v: boolean) => void) | null = null;

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  // Register setter globally so Navigation trigger can open it
  useEffect(() => {
    globalOpen = setOpen;
    return () => {
      globalOpen = null;
    };
  }, [setOpen]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggle]);

  return { open, setOpen };
}

// Allows Navigation button to open the palette without prop-drilling
export function openCommandPalette() {
  globalOpen?.(true);
}
