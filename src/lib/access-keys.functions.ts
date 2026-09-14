import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TOKEN_LENGTH = 30;

function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_ALPHABET[bytes[i]! % TOKEN_ALPHABET.length];
  }
  return out;
}

const UNIT_TO_MS: Record<string, number> = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

const createSchema = z.object({
  codeName: z.string().trim().min(1).max(80),
  unit: z.enum(["minute", "hour", "day", "week"]),
  amount: z.number().int().min(1).max(10000),
  maxDevices: z.number().int().min(1).max(1000),
});

export const createAccessKey = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = generateToken();
    const expiresAt = new Date(Date.now() + UNIT_TO_MS[data.unit]! * data.amount).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("access_keys")
      .insert({
        code_name: data.codeName,
        token,
        expires_at: expiresAt,
        max_devices: data.maxDevices,
      })
      .select("id, code_name, token, expires_at, max_devices, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listAccessKeys = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: keys, error } = await supabaseAdmin
    .from("access_keys")
    .select("id, code_name, token, expires_at, max_devices, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (keys ?? []).map((k) => k.id);
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: devs } = await supabaseAdmin
      .from("access_devices")
      .select("key_id")
      .in("key_id", ids);
    for (const d of devs ?? []) counts[d.key_id] = (counts[d.key_id] ?? 0) + 1;
  }
  return (keys ?? []).map((k) => ({ ...k, device_count: counts[k.id] ?? 0 }));
});

const deleteSchema = z.object({ id: z.string().uuid() });
export const deleteAccessKey = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("access_keys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const validateSchema = z.object({
  token: z.string().min(1).max(64),
  deviceId: z.string().min(1).max(128),
});

export const validateAccessToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => validateSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: key } = await supabaseAdmin
      .from("access_keys")
      .select("id, expires_at, max_devices")
      .eq("token", data.token)
      .maybeSingle();
    if (!key) return { ok: false as const, reason: "invalid" as const };
    if (new Date(key.expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }
    const { data: existing } = await supabaseAdmin
      .from("access_devices")
      .select("id")
      .eq("key_id", key.id)
      .eq("device_id", data.deviceId)
      .maybeSingle();
    if (existing) {
      return { ok: true as const, expiresAt: key.expires_at };
    }
    const { count } = await supabaseAdmin
      .from("access_devices")
      .select("id", { count: "exact", head: true })
      .eq("key_id", key.id);
    if ((count ?? 0) >= key.max_devices) {
      return { ok: false as const, reason: "device_limit" as const };
    }
    const { error: insErr } = await supabaseAdmin
      .from("access_devices")
      .insert({ key_id: key.id, device_id: data.deviceId });
    if (insErr) return { ok: false as const, reason: "invalid" as const };
    return { ok: true as const, expiresAt: key.expires_at };
  });
