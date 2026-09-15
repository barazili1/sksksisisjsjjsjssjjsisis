import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const ADMIN_PATH = "/admink9x7p2m4r8w1l5v0t3q6n7j8m2y4w9z1a5c3e7g9i1k3m5o7q";
const COOKIE_ACCESS = "lv_access";

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

const accessGateMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Bypass admin path
  if (path === ADMIN_PATH || path === ADMIN_PATH + "/") return next();

  // Bypass infrastructure, static assets, and the redeem endpoint itself.
  if (
    path.startsWith("/_serverFn") ||
    path.startsWith("/_build") ||
    path.startsWith("/__l5e") ||
    path.startsWith("/api/") ||
    path.startsWith("/assets/") ||
    path.startsWith("/@") ||
    path.startsWith("/node_modules") ||
    path.includes(".")
  ) {
    return next();
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  const raw = cookies[COOKIE_ACCESS];
  const { renderCodeEntryPage } = await import("./lib/access-gate-response");

  if (!raw) return renderCodeEntryPage({ reason: "invalid", hadCookie: false });
  const dot = raw.indexOf(".");
  if (dot < 0) return renderCodeEntryPage({ reason: "invalid", hadCookie: true });
  const token = raw.slice(0, dot);
  if (!token) return renderCodeEntryPage({ reason: "invalid", hadCookie: true });

  const { checkExistingAccess } = await import("./lib/access-gate.server");
  const res = await checkExistingAccess(token);
  if (!res.ok) return renderCodeEntryPage({ reason: res.reason, hadCookie: true });

  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, accessGateMiddleware, csrfMiddleware],
}));
