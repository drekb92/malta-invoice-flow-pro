import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Variant = 'draft-autosave' | 'draft-no-autosave' | 'quotation-edit' | 'credit-note';

interface UnsavedChangesDialogProps {
  open: boolean;
  variant: Variant;
  onSaveDraft: () => Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
}

const CONFIG: Record<Variant, { title: string; description: string }> = {
  'draft-autosave': {
    title: 'Leave and delete draft?',
    description: 'A draft has been saved automatically. You can delete it and leave, or stay to keep working.',
  },
  'draft-no-autosave': {
    title: 'Save before leaving?',
    description: 'You have unsaved changes that will be lost if you leave now.',
  },
  'quotation-edit': {
    title: 'Save before leaving?',
    description: 'You have unsaved changes to this quotation.',
  },
  'credit-note': {
    title: 'Discard credit note?',
    description: 'You have entered information that will be lost if you close this dialog.',
  },
};

export function UnsavedChangesDialog({
  open,
  variant,
  onSaveDraft,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  const { title, description } = CONFIG[variant];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {variant === 'draft-autosave' && (
            <>
              <Button onClick={onCancel} className="w-full">
                Keep Draft
              </Button>
              <Button variant="destructive" onClick={onDiscard} className="w-full">
                Delete Draft &amp; Leave
              </Button>
            </>
          )}
          {variant === 'credit-note' && (
            <>
              <Button onClick={onCancel} className="w-full">
                Keep Editing
              </Button>
              <Button variant="destructive" onClick={onDiscard} className="w-full">
                Discard
              </Button>
            </>
          )}
          {(variant === 'draft-no-autosave' || variant === 'quotation-edit') && (
            <>
              <Button onClick={onSaveDraft} className="w-full">
                Save as Draft
              </Button>
              <Button variant="outline" onClick={onDiscard} className="w-full">
                {variant === 'quotation-edit' ? 'Discard Changes' : 'Discard'}
              </Button>
              <Button variant="ghost" onClick={onCancel} className="w-full">
                Cancel
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
