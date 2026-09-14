import { useEffect, useState, type ReactNode } from "react";
import { readAccessSession, clearAccessSession, saveAccessSession } from "@/lib/access-session";

type State = "checking" | "ok" | "expired" | "denied";

/**
 * The server gate redirects /<token> to /?_lv=<token>.<expiresAt>.
 * Hydrate the local session from that param, then strip it from the URL.
 */
function bootstrapFromUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("_lv");
  if (!raw) return;
  const dot = raw.indexOf(".");
  if (dot > 0) {
    const token = raw.slice(0, dot);
    const expiresAt = raw.slice(dot + 1);
    if (token && expiresAt && !Number.isNaN(new Date(expiresAt).getTime())) {
      saveAccessSession(token, expiresAt);
    }
  }
  params.delete("_lv");
  const qs = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    bootstrapFromUrl();
    const check = () => {
      const s = readAccessSession();
      if (!s) {
        const hasToken = typeof window !== "undefined" && localStorage.getItem("access_token_v1");
        if (hasToken) {
          clearAccessSession();
          setState("expired");
        } else {
          setState("denied");
        }
        return false;
      }
      setState("ok");
      return true;
    };
    if (!check()) return;
    const expiresAt = readAccessSession()?.expiresAt;
    if (!expiresAt) return;
    const ms = new Date(expiresAt).getTime() - Date.now();
    const t = setTimeout(() => {
      clearAccessSession();
      setState("expired");
    }, Math.max(0, ms));
    const i = setInterval(check, 15000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, []);

  if (state === "checking") {
    return <div className="min-h-screen bg-background" />;
  }
  if (state === "denied") return <AccessDenied reason="invalid" />;
  if (state === "expired") return <AccessDenied reason="expired" />;
  return <>{children}</>;
}

export function AccessDenied({
  reason,
}: {
  reason: "invalid" | "expired" | "device_limit" | "no_balance";
}) {
  const title =
    reason === "expired"
      ? "انتهت صلاحية الرابط"
      : reason === "device_limit"
      ? "تم تجاوز عدد الأجهزة المسموح بها"
      : reason === "no_balance"
      ? "الرصيد انتهى"
      : "الوصول مرفوض";
  const desc =
    reason === "expired"
      ? "الرابط ده مش شغّال دلوقتي، اطلب رابط جديد."
      : reason === "device_limit"
      ? "الرابط ده استخدمه أقصى عدد من الأجهزة."
      : reason === "no_balance"
      ? "الخدمة موقوفة مؤقتًا لحد ما يتشحن الرصيد."
      : "مش مسموحلك تدخل الصفحة دي بدون رابط صالح.";
  return (
    <div
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 px-6"
    >
      <div className="max-w-sm rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-400">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M4.93 4.93l14.14 14.14" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{desc}</p>
      </div>
    </div>
  );
}
