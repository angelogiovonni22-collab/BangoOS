type RequestErrorContext = {
  path?: string;
  method?: string;
};

type RouterErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
};

export function onRequestError(error: unknown, request: RequestErrorContext, context: RouterErrorContext) {
  const safeError = error instanceof Error
    ? { name: error.name, cause: error.cause instanceof Error ? error.cause.name : undefined }
    : { name: "UnknownError" };

  console.error(JSON.stringify({
    event: "bos.request.error",
    error: safeError,
    request: { method: request.method, path: request.path },
    route: { kind: context.routerKind, path: context.routePath, type: context.routeType, source: context.renderSource, revalidateReason: context.revalidateReason },
    deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
    recordedAt: new Date().toISOString(),
  }));
}
