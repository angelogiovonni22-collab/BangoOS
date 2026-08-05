type OrionCommandResultLike = {
  href: string | null;
  details?: Record<string, unknown>;
};

type ApplyOrionCommandNavigationParams = {
  result: OrionCommandResultLike;
  canGoBack: boolean;
  goBack: () => void;
  push: (href: string) => void;
};

export type OrionCommandNavigationOutcome = {
  performed: boolean;
  usedFallback: boolean;
  fallbackHref: string | null;
  mode: "back" | "push" | "none";
};

export function applyOrionCommandNavigationResult(params: ApplyOrionCommandNavigationParams): OrionCommandNavigationOutcome {
  const details = params.result.details || {};
  const navigationAction = typeof details.navigationAction === "string" ? details.navigationAction : null;
  const fallbackHref = typeof details.fallbackHref === "string" && details.fallbackHref.trim()
    ? details.fallbackHref.trim()
    : null;

  if (navigationAction === "back") {
    if (params.canGoBack) {
      params.goBack();
      return {
        performed: true,
        usedFallback: false,
        fallbackHref: null,
        mode: "back",
      };
    }

    const safeFallback = fallbackHref || params.result.href || "/dashboard";
    params.push(safeFallback);
    return {
      performed: true,
      usedFallback: true,
      fallbackHref: safeFallback,
      mode: "push",
    };
  }

  if (params.result.href) {
    params.push(params.result.href);
    return {
      performed: true,
      usedFallback: false,
      fallbackHref: null,
      mode: "push",
    };
  }

  return {
    performed: false,
    usedFallback: false,
    fallbackHref: null,
    mode: "none",
  };
}