import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useInvoiceShareLink } from "@/hooks/useInvoiceShareLink";
import { Link2, Copy, Check, Loader2, Trash2, ExternalLink, Globe, ShieldAlert } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ShareLinkPanelProps {
  invoiceId: string;
  invoiceNumber: string;
}

export function ShareLinkPanel({ invoiceId, invoiceNumber }: ShareLinkPanelProps) {
  const { toast } = useToast();
  const { shareLink, loading, creating, revoking, createLink, revokeLink, publicUrl } = useInvoiceShareLink(invoiceId);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    await createLink();
    toast({ title: "Share link created", description: "Anyone with the link can view this invoice." });
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast({ title: "Link copied!", description: "Paste it anywhere to share." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    await revokeLink();
    toast({
      title: "Link revoked",
      description: "The previous link no longer works.",
      variant: "destructive",
    });
  };

  const expiresAt = shareLink?.expires_at ? new Date(shareLink.expires_at) : null;
  const isExpired = expiresAt ? isPast(expiresAt) : false;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Client View Link</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading…
        </div>
      ) : shareLink && !isExpired ? (
        /* ── Active link ─────────────────────────────────────── */
        <div className="space-y-2">
          {/* URL display */}
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
            <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-xs font-mono text-muted-foreground">{publicUrl}</span>
          </div>

          {/* Expiry */}
          <p className="text-[11px] text-muted-foreground px-0.5">
            Expires <span className="font-medium text-foreground">{format(expiresAt!, "d MMM yyyy")}</span> (
            {formatDistanceToNow(expiresAt!, { addSuffix: true })})
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Link
                </>
              )}
            </Button>

            <Button size="sm" variant="outline" className="h-8 px-2.5" asChild>
              <a href={publicUrl!} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>

            {/* Revoke */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                  disabled={revoking}
                >
                  {revoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke share link?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Anyone currently viewing invoice {invoiceNumber} via this link will lose access immediately. You can
                    create a new link at any time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRevoke} className="bg-destructive hover:bg-destructive/90">
                    Revoke Link
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : (
        /* ── No active link ──────────────────────────────────── */
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Create a secure link your client can open in any browser — no account needed. Valid for 90 days.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs gap-1.5"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" />
                Create Share Link
              </>
            )}
          </Button>
          {shareLink && isExpired && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-600">
              <ShieldAlert className="h-3 w-3" />
              Previous link expired — create a new one
            </div>
          )}
        </div>
      )}
    </div>
  );
}
