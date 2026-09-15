import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type GateReason = "invalid" | "expired";
export type GateResult =
  | { ok: true; expiresAt: string }
  | { ok: false; reason: GateReason };

type KeyRow = {
  id: string;
  expires_at: string | null;
  duration_ms: number | null;
  balance: number | string | null;
};

const DEFAULT_DURATION_MS = 24 * 60 * 60 * 1000;

async function loadKey(token: string): Promise<KeyRow | null> {
  const { data } = await supabaseAdmin
    .from("access_keys")
    .select("id, expires_at, duration_ms, balance")
    .eq("token", token)
    .maybeSingle<KeyRow>();
  return data ?? null;
}

function isExpired(key: KeyRow): boolean {
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) return true;
  if (Number(key.balance ?? 0) <= 0) return true;
  return false;
}

/**
 * Validates a code (token) and registers the device for tracking.
 * No device limit is enforced — any number of devices can use the same code.
 * The countdown starts the first time the code is actually used.
 */
export async function validateAndRegister(
  token: string,
  deviceId: string,
): Promise<GateResult> {
  const key = await loadKey(token);
  if (!key) return { ok: false, reason: "invalid" };
  if (isExpired(key)) return { ok: false, reason: "expired" };

  // Track device without enforcing any limit.
  const { data: existing } = await supabaseAdmin
    .from("access_devices")
    .select("id")
    .eq("key_id", key.id)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!existing) {
    await supabaseAdmin
      .from("access_devices")
      .insert({ key_id: key.id, device_id: deviceId });
  }

  let expiresAt = key.expires_at;
  if (!expiresAt) {
    const now = new Date();
    expiresAt = new Date(now.getTime() + (key.duration_ms ?? DEFAULT_DURATION_MS)).toISOString();
    await supabaseAdmin
      .from("access_keys")
      .update({ expires_at: expiresAt, activated_at: now.toISOString() })
      .eq("id", key.id)
      .is("expires_at", null);
  }

  return { ok: true, expiresAt };
}

export async function checkExistingAccess(token: string): Promise<GateResult> {
  const key = await loadKey(token);
  if (!key) return { ok: false, reason: "invalid" };
  if (isExpired(key)) return { ok: false, reason: "expired" };
  const expiresAt =
    key.expires_at ??
    new Date(Date.now() + (key.duration_ms ?? DEFAULT_DURATION_MS)).toISOString();
  return { ok: true, expiresAt };
}

export async function getBalanceForToken(token: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from("access_keys")
    .select("balance")
    .eq("token", token)
    .maybeSingle<{ balance: number | string | null }>();
  if (!data) return null;
  return Number(data.balance ?? 0);
}
