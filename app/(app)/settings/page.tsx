"use client";

import Link from "next/link";
import { OrionVoiceSettingsPanel } from "@/components/orion/voice";
import { Card, CardContent, CardHeader, CardTitle, LayoutGallery, PageHeader, ThemeGallery } from "@/components/ui";
import { useCompany } from "@/lib/company";
import { hasBosPermission } from "@/lib/access-control/permissions";
import { useI18n } from "@/lib/i18n/provider";

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const { role } = useCompany();
  const canManageAccess = hasBosPermission(role, "access_control.manage");
  const canManageBilling = role === "owner" || role === "administrator";
  const canManageOperatingProfile = role === "owner" || role === "administrator";
  const es = locale === "es";

  return (
    <div className="container-narrow space-y-[var(--space-section)]">
      <PageHeader compact eyebrow={t("settings.eyebrow")} title={t("navigation.settings")} description={t("settings.description")} />

      {canManageOperatingProfile ? <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]">
          <CardTitle>{es ? "Perfil operativo adaptable" : "Adaptive operating profile"}</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">{es ? "Define la industria, el modelo de negocio y los servicios que B.O.S. usará para adaptar terminología, módulos y flujos de trabajo." : "Define the industry, business model, and services B.O.S. uses to adapt terminology, modules, and workflows."}</p>
        </CardHeader>
        <CardContent className="p-5"><Link href="/settings/operating-profile" className="inline-flex items-center rounded-[10px] bg-[var(--color-action-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-105">{es ? "Configurar B.O.S. adaptable" : "Configure Adaptive B.O.S."}</Link></CardContent>
      </Card> : null}

      {canManageAccess ? <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]">
          <CardTitle>{t("settings.rolesTitle")}</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("settings.rolesDescription")}</p>
        </CardHeader>
        <CardContent className="p-5"><Link href="/settings/access-control" className="inline-flex items-center rounded-[10px] bg-[var(--color-action-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-105">{t("settings.openAccessControl")}</Link></CardContent>
      </Card> : null}

      {canManageBilling ? <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]">
          <CardTitle>{t("settings.billingTitle")}</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("settings.billingDescription")}</p>
        </CardHeader>
        <CardContent className="p-5"><Link href="/settings/billing" className="inline-flex items-center rounded-[10px] bg-[var(--color-action-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-105">{t("settings.openBilling")}</Link></CardContent>
      </Card> : null}

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]">
          <CardTitle>{es ? "Privacidad y eliminación de cuenta" : "Privacy & account deletion"}</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {es
              ? "Revisa cómo solicitar la eliminación de tu cuenta de B.O.S. y los datos personales asociados."
              : "Review and initiate deletion of your B.O.S. account and associated personal data."}
          </p>
        </CardHeader>
        <CardContent className="p-5"><Link href="/settings/account-deletion" className="inline-flex items-center rounded-[10px] border border-red-700 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">{es ? "Administrar eliminación de cuenta" : "Manage account deletion"}</Link></CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]">
          <CardTitle>{t("settings.layoutTitle")}</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("settings.layoutDescription")}</p>
        </CardHeader>
        <CardContent className="space-y-5 p-5"><div><p className="font-semibold text-[var(--color-text-primary)]">{t("settings.workspaceLayout")}</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("settings.workspaceLayoutDescription")}</p></div><LayoutGallery /></CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]"><CardTitle>{t("settings.themeTitle")}</CardTitle><p className="text-sm text-[var(--color-text-secondary)]">{t("settings.themeDescription")}</p></CardHeader>
        <CardContent className="space-y-5 p-5"><div><p className="font-semibold text-[var(--color-text-primary)]">{t("settings.themesExperiences")}</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("settings.themesExperiencesDescription")}</p></div><ThemeGallery /></CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]"><CardTitle>{t("navigation.settings")}</CardTitle><p className="text-sm text-[var(--color-text-secondary)]">{t("projects.memorySettingsDescription")}</p></CardHeader>
        <CardContent className="p-5"><Link href="/settings/memory-review" className="inline-flex items-center rounded-[10px] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]">{t("projects.memoryReviewOpen")}</Link></CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]"><CardTitle>{t("settings.orionVoice")}</CardTitle><p className="text-sm text-[var(--color-text-secondary)]">{t("settings.orionVoiceDescription")}</p></CardHeader>
        <CardContent className="p-5"><OrionVoiceSettingsPanel /></CardContent>
      </Card>
    </div>
  );
}
