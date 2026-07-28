"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";

type ProfileMenuProps = {
  userEmail: string | null;
  userName: string | null;
  companyName: string | null;
  showSettingsAction?: boolean;
};

function getInitials(name: string | null, email: string | null) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return parts[0].slice(0, 2).toUpperCase();
  }

  if (email && email.length > 0) {
    return email.slice(0, 2).toUpperCase();
  }

  return "U";
}

export function ProfileMenu({
  userEmail,
  userName,
  companyName,
  showSettingsAction = false,
}: ProfileMenuProps) {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const initials = getInitials(userName, userEmail);
  const displayName = userName?.trim() || userEmail || t("common.unknownUser");

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setErrorMessage(null);
    setIsSigningOut(true);

    try {
      if (!supabase) {
        setErrorMessage(t("common.errorConnect"));
        return;
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage(error.message || t("common.signOutFailed"));
        return;
      }

      router.push("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={menuButtonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="bangoos-profile-menu"
        aria-label={t("common.userMenu")}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 font-semibold text-white shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
        onClick={() => setIsOpen((current) => !current)}
      >
        {initials}
      </button>

      <div
        id="bangoos-profile-menu"
        role="menu"
        aria-label={t("common.userMenu")}
        className={`absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-xl transition duration-150 ${
          isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-sm font-semibold text-slate-900">{displayName}</p>
          {companyName ? <p className="mt-1 text-xs text-slate-500">{companyName}</p> : null}
          {!companyName ? <p className="mt-1 text-xs text-slate-500">{t("common.noCompanyAssigned")}</p> : null}
        </div>

        <div className="mt-2 space-y-1">
          <Link
            href="/onboarding"
            role="menuitem"
            className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
            onClick={() => setIsOpen(false)}
          >
            {t("common.account")}
          </Link>

          {showSettingsAction ? (
            <Link
              href="/settings"
              role="menuitem"
              className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              onClick={() => setIsOpen(false)}
            >
              {t("navigation.settings")}
            </Link>
          ) : null}

          <button
            type="button"
            role="menuitem"
            disabled={isSigningOut}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void handleSignOut();
            }}
          >
            {isSigningOut ? t("common.signingOut") : t("common.signOut")}
          </button>
        </div>

        {errorMessage ? (
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
