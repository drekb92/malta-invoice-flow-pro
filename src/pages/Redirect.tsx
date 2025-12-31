import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Redirect = () => {
  const [searchParams] = useSearchParams();
  const url = searchParams.get("url");

  useEffect(() => {
    if (url?.startsWith("https://wa.me")) {
      window.location.replace(url);
    }
  }, [url]);

  const isValidUrl = url?.startsWith("https://wa.me");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      {isValidUrl ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecting to WhatsApp...</p>
          <a
            href={url}
            className="text-sm text-primary underline"
          >
            Click here if not redirected
          </a>
        </>
      ) : (
        <p className="text-destructive">Invalid redirect URL</p>
      )}
    </div>
  );
};

export default Redirect;
