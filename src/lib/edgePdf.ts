import { supabase } from "@/integrations/supabase/client";
import { generateDebugComment } from "@/lib/pdfConsistency";
import { PDF_PRINT_STYLES } from "@/lib/pdfPrintStyles";

/**
 * PDF export – FREE engine (default)
 *
 * Why this exists:
 * The previous implementation depended on a 3rd‑party API (html2pdf.app) via an Edge Function.
 * If the API key is missing/limited/blocked, PDF generation fails.
 *
 * This implementation is **free and reliable**:
 * - Builds a clean A4 HTML document from the hidden preview (#invoice-preview-root)
 * - Opens a print window (browser Print → Save as PDF)
 * - Inlines images (logos) to avoid CORS/tainting issues
 *
 * If you later want true “one-click download” PDFs, you can re-enable the Edge engine
 * via `downloadPdfFromEdgeFunction()`.
 */

type ExportMode = "print" | "edge";

function getExportMode(): ExportMode {
  // Default to edge engine (direct download, no popup).
  // You can override by setting VITE_PDF_EXPORT_MODE=print in your environment for browser print dialog.
  const mode = (import.meta as any)?.env?.VITE_PDF_EXPORT_MODE;
  return mode === "print" ? "print" : "edge";
}

async function inlineImages(container: HTMLElement) {
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        const res = await fetch(src, { mode: "cors" });
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        img.setAttribute("src", dataUrl);
      } catch (e) {
        console.warn("[PDF] Failed to inline image:", src, e);
      }
    }),
  );
}

function captureCssVars(root: HTMLElement) {
  let cssVars = "";
  try {
    const computed = getComputedStyle(root);
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      if (prop && prop.startsWith("--")) {
        const val = computed.getPropertyValue(prop).trim();
        if (val) cssVars += `${prop}: ${val};`;
      }
    }
  } catch (e) {
    console.warn("[PDF] Failed to extract CSS variables:", e);
  }
  return cssVars;
}

export function buildA4HtmlDocument(opts: { filename: string; fontFamily: string; clonedRoot: HTMLElement; debug?: boolean }) {
  const { filename, fontFamily, clonedRoot, debug } = opts;
  const encodedFamily = encodeURIComponent(fontFamily);

  const debugComment = debug
    ? `\n${generateDebugComment({
        isConsistent: true,
        warnings: [],
        errors: [],
        details: {
          hasCompanySettings: true,
          hasBankingSettings: true,
          hasTemplateSettings: true,
          layoutType: "unknown",
          variant: "pdf",
        },
      })}\n`
    : "";

  // Important: the invoice layout component already includes its embedded CSS.
  // Here we add only print normalization rules (repeating headers, avoid row splits, etc.).
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${filename}</title>${debugComment}
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: A4; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body {
        color-scheme: light;
        background: #ffffff;
        font-family: '${fontFamily}', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      #invoice-preview-root { width: 210mm; min-height: 297mm; margin: 0 auto; }
      ${PDF_PRINT_STYLES}
    </style>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@400;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    ${clonedRoot.outerHTML}
    <script>
      // Give the browser a tick to finish layout before print.
      window.addEventListener('load', () => {
        setTimeout(() => {
          try { window.focus(); } catch (e) {}
        }, 50);
      });
    </script>
  </body>
</html>`;
}

async function exportViaPrintWindow(filename: string, selectedFontFamily?: string, debug = false) {
  const root = document.getElementById("invoice-preview-root") as HTMLElement | null;
  if (!root) throw new Error("Preview root not found (invoice-preview-root).");

  const fontFamily = selectedFontFamily || "Inter";

  // Clone and inline images so logos render in the print window.
  const cloned = root.cloneNode(true) as HTMLElement;
  await inlineImages(cloned);

  // Preserve CSS variables from on-screen preview.
  const cssVars = captureCssVars(root);
  if (cssVars) {
    const existing = cloned.getAttribute("style") || "";
    cloned.setAttribute("style", `${existing}${existing ? " " : ""}${cssVars}`);
  }

  const html = buildA4HtmlDocument({ filename, fontFamily, clonedRoot: cloned, debug });

  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) throw new Error("Popup blocked. Please allow popups to export PDF.");

  w.document.open();
  w.document.write(html);
  w.document.close();

  // Print after fonts load (best-effort).
  // @ts-ignore
  const fontsReady = (w.document as any)?.fonts?.ready;
  if (fontsReady?.then) {
    try {
      await fontsReady;
    } catch {
      // ignore
    }
  }

  // Give layout a moment to settle
  await new Promise((r) => setTimeout(r, 150));
  w.focus();
  w.print();
}

/**
 * Optional: Edge engine (requires server-side PDF service working).
 * Keep this for later if you move to a proper Chromium renderer.
 */
export async function downloadPdfFromEdgeFunction(filename: string, selectedFontFamily?: string, debug = false) {
  const root = document.getElementById("invoice-preview-root") as HTMLElement | null;
  if (!root) throw new Error("Preview root not found (invoice-preview-root).");

  const family = selectedFontFamily || "Inter";
  const cloned = root.cloneNode(true) as HTMLElement;
  await inlineImages(cloned);

  const cssVars = captureCssVars(root);
  if (cssVars) {
    const existingStyle = cloned.getAttribute("style") || "";
    cloned.setAttribute("style", `${existingStyle}${existingStyle ? " " : ""}${cssVars}`);
  }

  const html = buildA4HtmlDocument({ filename, fontFamily: family, clonedRoot: cloned, debug });

  const fnUrl = "https://cmysusctooyobrlnwtgt.functions.supabase.co/generate-invoice-pdf";
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ html, filename }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Public API used by the app.
 * Default engine is PRINT (free). If VITE_PDF_EXPORT_MODE=edge, it will try edge.
 */
export async function downloadPdfFromFunction(filename: string, selectedFontFamily?: string, debug = false) {
  const mode = getExportMode();
  if (mode === "edge") {
    return downloadPdfFromEdgeFunction(filename, selectedFontFamily, debug);
  }
  return exportViaPrintWindow(filename, selectedFontFamily, debug);
}
