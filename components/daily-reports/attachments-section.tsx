import { Button, Input, Select } from "@/components/ui";
import type { AttachmentItem } from "@/lib/daily-reports";

type AttachmentsSectionProps = {
  value: AttachmentItem[];
  onChange: (next: AttachmentItem[]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

function newAttachment(): AttachmentItem {
  return {
    id: `att-${Math.random().toString(36).slice(2, 8)}`,
    fileName: "",
    caption: "",
    category: "progress",
    uploadedAt: new Date().toISOString(),
  };
}

export function AttachmentsSection({ value, onChange, t }: AttachmentsSectionProps) {
  const update = (id: string, patch: Partial<AttachmentItem>) => {
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("dailyReports.sections.attachments")}</h3>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, newAttachment()])}>{t("dailyReports.actions.addAttachment")}</Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {value.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
            <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
              <span>{t("dailyReports.fields.filename")}</span>
              <Input value={item.fileName} onChange={(event) => update(item.id, { fileName: event.target.value })} placeholder="photo-01.jpg" />
            </label>
            <label className="mt-2 block space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
              <span>{t("dailyReports.fields.caption")}</span>
              <Input value={item.caption} onChange={(event) => update(item.id, { caption: event.target.value })} />
            </label>
            <label className="mt-2 block space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
              <span>{t("dailyReports.fields.category")}</span>
              <Select value={item.category} onChange={(event) => update(item.id, { category: event.target.value as AttachmentItem["category"] })}>
                <option value="progress">{t("dailyReports.attachmentCategory.progress")}</option>
                <option value="safety">{t("dailyReports.attachmentCategory.safety")}</option>
                <option value="quality">{t("dailyReports.attachmentCategory.quality")}</option>
                <option value="delivery">{t("dailyReports.attachmentCategory.delivery")}</option>
                <option value="incident">{t("dailyReports.attachmentCategory.incident")}</option>
                <option value="other">{t("dailyReports.attachmentCategory.other")}</option>
              </Select>
            </label>

            <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
              {t("dailyReports.fields.uploadedAt")} {new Date(item.uploadedAt).toLocaleString()}
            </p>

            <div className="mt-3 flex justify-between">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-[var(--radius-md)] bg-white text-xs font-semibold text-[var(--color-text-secondary)]">
                JPG
              </span>
              <Button variant="danger" size="sm" onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}>{t("dailyReports.actions.remove")}</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
