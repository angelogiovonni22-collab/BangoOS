"use client";

import { useState } from "react";
import { Files, ReceiptText } from "lucide-react";
import { ProjectLinkedModuleWorkspace } from "./project-linked-module-workspace";
import { ProjectReceiptsWorkspace } from "./project-receipts-workspace";

type ProjectDocumentsWorkspaceProps = {
  projectId: string;
  localeTag: string;
};

type DocumentsSection = "documents" | "receipts";

const DOCUMENT_SECTIONS: Array<{ key: DocumentsSection; label: string; icon: typeof Files }> = [
  { key: "documents", label: "Documents", icon: Files },
  { key: "receipts", label: "Receipts", icon: ReceiptText },
];

export function ProjectDocumentsWorkspace({ projectId, localeTag }: ProjectDocumentsWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<DocumentsSection>("documents");

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] border border-[var(--bos-border-light)] bg-white p-2.5 shadow-[var(--bos-shadow-workspace-card)]">
        <nav className="flex flex-wrap gap-1" role="tablist" aria-label="Project document sections">
          {DOCUMENT_SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.key;

            return (
              <button
                key={section.key}
                type="button"
                role="tab"
                aria-selected={active}
                data-orion-action={`project-documents-tab-${section.key}`}
                data-orion-role={`project documents tab: ${section.label}`}
                onClick={() => setActiveSection(section.key)}
                className={`inline-flex items-center gap-2 rounded-[12px] border px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${
                  active
                    ? "border-[var(--workspace-tab-active-border)] [background:var(--workspace-tab-active-surface)] text-white shadow-[0_8px_16px_-12px_rgba(30,120,255,0.7)]"
                    : "border-transparent text-[var(--bos-text-medium-on-light)] hover:border-[var(--bos-border-light-strong)] hover:bg-[var(--color-neutral-50)] hover:text-[var(--bos-text-strong-on-light)]"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {section.label}
              </button>
            );
          })}
        </nav>
      </section>

      {activeSection === "receipts" ? (
        <ProjectReceiptsWorkspace projectId={projectId} />
      ) : (
        <ProjectLinkedModuleWorkspace projectId={projectId} tab="documents" localeTag={localeTag} />
      )}
    </div>
  );
}
