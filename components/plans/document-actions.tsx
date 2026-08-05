import { Download, EllipsisVertical, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui";

type DocumentActionsProps = {
  fileName: string;
  onPreview: () => void;
};

export function DocumentActions({ fileName, onPreview }: DocumentActionsProps) {
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
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Download ${fileName}`}
        title="Download is unavailable because no connected plan file URL is available."
        disabled
      >
        <Download size={15} aria-hidden="true" />
      </Button>
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
