import { Download, EllipsisVertical, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui";

type DocumentActionsProps = {
  fileName: string;
  fileUrl?: string | null;
  onPreview: () => void;
};

export function DocumentActions({ fileName, fileUrl, onPreview }: DocumentActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Preview ${fileName}`}
        onClick={onPreview}
      >
        <ExternalLink size={15} aria-hidden="true" />
      </Button>
      {fileUrl ? (
        <a href={fileUrl} download target="_blank" rel="noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]" aria-label={`Download ${fileName}`}>
          <Download size={15} aria-hidden="true" />
        </a>
      ) : (
        <Button size="sm" variant="ghost" aria-label={`Download ${fileName}`} title="No connected plan file is available." disabled><Download size={15} aria-hidden="true" /></Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        aria-label={`More actions for ${fileName}`}
        title="Additional document actions are unavailable for this record."
        disabled
      >
        <EllipsisVertical size={15} aria-hidden="true" />
      </Button>
    </div>
  );
}
