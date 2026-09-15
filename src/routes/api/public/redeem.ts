import { createFileRoute } from "@tanstack/react-router";

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

export const Route = createFileRoute("/api/public/redeem")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let code = "";
        try {
          const body = (await request.json()) as { code?: unknown };
          code = typeof body.code === "string" ? body.code.trim() : "";
        } catch {
          return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
        }
        if (!code || code.length > 64) {
          return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
        }

        const cookies = parseCookies(request.headers.get("cookie"));
        const deviceId = cookies[COOKIE_DEVICE] ?? crypto.randomUUID();

        const { validateAndRegister } = await import("@/lib/access-gate.server");
        const res = await validateAndRegister(code, deviceId);
        if (!res.ok) {
          return Response.json({ ok: false, reason: res.reason });
        }

        const headers = new Headers({ "content-type": "application/json" });
        headers.append("Set-Cookie", cookie(COOKIE_ACCESS, `${code}.${deviceId}`, res.expiresAt));
        headers.append("Set-Cookie", cookie(COOKIE_DEVICE, deviceId, res.expiresAt));
        return new Response(
          JSON.stringify({ ok: true, expiresAt: res.expiresAt }),
          { status: 200, headers },
        );
      },
    },
  },
});
