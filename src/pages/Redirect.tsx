import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Redirect page for WhatsApp (and any other external URLs).
 *
 * The problem with window.location.replace(url) is that if the app is
 * running inside an iframe (e.g. Lovable preview), wa.me redirects to
 * api.whatsapp.com which sends X-Frame-Options: DENY, causing an
 * ERR_BLOCKED_BY_RESPONSE error.
 *
 * Fix: open the target URL in a brand-new top-level tab using
 * window.open with target="_blank" and rel="noopener", then close
 * this intermediate tab automatically.
 */
const Redirect = () => {
  const [searchParams] = useSearchParams();
  const url = searchParams.get("url");

  const isValidUrl = url?.startsWith("https://wa.me") || url?.startsWith("https://api.whatsapp.com");

  useEffect(() => {
    if (!isValidUrl || !url) return;

    // Open in a true new tab at the top level — bypasses any iframe restriction
    const newTab = window.open(url, "_blank", "noopener,noreferrer");

    // If the new tab opened successfully, close this redirect tab
    if (newTab) {
      // Small delay so the new tab has time to start loading
      setTimeout(() => {
        try {
          window.close();
        } catch {
          /* ignore — some browsers block this */
        }
      }, 300);
    }
  }, [url, isValidUrl]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      {isValidUrl ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Opening WhatsApp...</p>
          <a href={url!} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
            Click here if WhatsApp doesn't open
          </a>
        </>
      ) : (
        <p className="text-destructive">Invalid redirect URL</p>
      )}
    </div>
  );
};

export default Redirect;
