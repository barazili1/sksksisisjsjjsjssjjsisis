import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type GateResult =
  | { ok: true; expiresAt: string }
  | { ok: false; reason: "invalid" | "expired" | "device_limit" };

type KeyRow = {
  id: string;
  expires_at: string | null;
  max_devices: number;
  duration_ms: number | null;
};

const DEFAULT_DURATION_MS = 24 * 60 * 60 * 1000;

async function loadKey(token: string): Promise<KeyRow | null> {
  const { data } = await supabaseAdmin
    .from("access_keys")
    .select("id, expires_at, max_devices, duration_ms")
    .eq("token", token)
    .maybeSingle<KeyRow>();
  return data ?? null;
}

/**
 * Validates a token and registers the device.
 * The countdown only starts the first time the link is actually opened:
 * keys are created with expires_at = null and get stamped here.
 */
export async function validateAndRegister(
  token: string,
  deviceId: string,
): Promise<GateResult> {
  const key = await loadKey(token);
  if (!key) return { ok: false, reason: "invalid" };
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const { data: existing } = await supabaseAdmin
    .from("access_devices")
    .select("id")
    .eq("key_id", key.id)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (!existing) {
    const { count } = await supabaseAdmin
      .from("access_devices")
      .select("id", { count: "exact", head: true })
      .eq("key_id", key.id);
    if ((count ?? 0) >= key.max_devices) {
      return { ok: false, reason: "device_limit" };
    }
    await supabaseAdmin
      .from("access_devices")
      .insert({ key_id: key.id, device_id: deviceId });
  }

  let expiresAt = key.expires_at;
  if (!expiresAt) {
    const now = new Date();
    expiresAt = new Date(
      now.getTime() + (key.duration_ms ?? DEFAULT_DURATION_MS),
    ).toISOString();
    await supabaseAdmin
      .from("access_keys")
      .update({ expires_at: expiresAt, activated_at: now.toISOString() })
      .eq("id", key.id)
      .is("expires_at", null);
  }

  return { ok: true, expiresAt };
}

export async function checkExistingAccess(
  token: string,
  deviceId: string,
): Promise<GateResult> {
  const key = await loadKey(token);
  if (!key) return { ok: false, reason: "invalid" };
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  const { data: dev } = await supabaseAdmin
    .from("access_devices")
    .select("id")
    .eq("key_id", key.id)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!dev) return { ok: false, reason: "invalid" };
  const expiresAt =
    key.expires_at ??
    new Date(Date.now() + (key.duration_ms ?? DEFAULT_DURATION_MS)).toISOString();
  return { ok: true, expiresAt };
}
