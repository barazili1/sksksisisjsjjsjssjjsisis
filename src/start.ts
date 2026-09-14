import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const ADMIN_PATH = "/admink9x7p2m4r8w1l5v0t3q6n7j8m2y4w9z1a5c3e7g9i1k3m5o7q";
const TOKEN_RE = /^\/([A-Za-z0-9]{30})$/;
const COOKIE_ACCESS = "lv_access";
const COOKIE_DEVICE = "lv_device";

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

function cookie(name: string, value: string, expiresAt: string): string {
  const exp = new Date(expiresAt).toUTCString();
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${exp}`;
}

const accessGateMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Bypass admin path (and its assets/serverFn calls happen on other prefixes)
  if (path === ADMIN_PATH || path === ADMIN_PATH + "/") {
    return next();
  }

  // Bypass infrastructure and static assets
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

  // Token entry: /<30 alphanumeric>
  const m = path.match(TOKEN_RE);
  if (m) {
    const token = m[1]!;
    const deviceId = cookies[COOKIE_DEVICE] ?? crypto.randomUUID();
    const { validateAndRegister } = await import("./lib/access-gate.server");
    const { denyResponse } = await import("./lib/access-gate-response");
    const res = await validateAndRegister(token, deviceId);
    if (!res.ok) return denyResponse(res.reason);
    const headers = new Headers();
    headers.append("Set-Cookie", cookie(COOKIE_ACCESS, `${token}.${deviceId}`, res.expiresAt));
    headers.append("Set-Cookie", cookie(COOKIE_DEVICE, deviceId, res.expiresAt));
    headers.set("Location", "/");
    headers.set("cache-control", "no-store");
    return new Response(null, { status: 302, headers });
  }

  // All other paths: require valid access cookie
  const raw = cookies[COOKIE_ACCESS];
  const { denyResponse } = await import("./lib/access-gate-response");
  if (!raw) return denyResponse("invalid");
  const dot = raw.indexOf(".");
  if (dot < 0) return denyResponse("invalid");
  const token = raw.slice(0, dot);
  const deviceId = raw.slice(dot + 1);
  if (!token || !deviceId) return denyResponse("invalid");
  const { checkExistingAccess } = await import("./lib/access-gate.server");
  const res = await checkExistingAccess(token, deviceId);
  if (!res.ok) return denyResponse(res.reason);

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
