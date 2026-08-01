import { Badge } from "@/components/ui";
import type { ExecutiveNotification } from "@/lib/orion/executive-brief-types";

type ExecutiveNotificationStripProps = {
  notifications: ExecutiveNotification[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ExecutiveNotificationStrip({ notifications, t }: ExecutiveNotificationStripProps) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">{t("orion.notificationsTitle")}</p>
      <div className="flex flex-wrap gap-2">
        {notifications.map((notification) => (
          <Badge key={notification.id} className={toneClass(notification.tone)}>{notification.message}</Badge>
        ))}
      </div>
    </section>
  );
}

function toneClass(tone: ExecutiveNotification["tone"]) {
  if (tone === "success") {
    return "bg-[var(--color-success-50)] text-[var(--color-success-700)]";
  }

  if (tone === "warning") {
    return "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]";
  }

  return "bg-[var(--color-primary-50)] text-[var(--color-brand-700)]";
}