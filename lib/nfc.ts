import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function hashAccessCode(code: string) {
  const data = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyNfcAccess(params: { code: string; permissionKey?: string }) {
  const code = String(params.code ?? "").trim();
  if (!code) return { ok: false as const, error: "Missing NFC code" };
  const admin = supabaseAdmin();
  const codeHash = await hashAccessCode(code);
  const { data: tag, error: tagErr } = await admin
    .from("nfc_access_tags")
    .select("id,role,is_active")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (tagErr) return { ok: false as const, error: tagErr.message };
  if (!tag || !tag.is_active) return { ok: false as const, error: "NFC not recognized" };

  const role = String(tag.role ?? "").toLowerCase();
  const permissionKey = String(params.permissionKey ?? "").trim();
  let allowedRoles: string[] = ["admin"];
  if (permissionKey) {
    const { data: perm, error: permErr } = await admin
      .from("access_permissions")
      .select("allowed_roles")
      .eq("permission_key", permissionKey)
      .maybeSingle();
    if (permErr) return { ok: false as const, error: permErr.message };
    const list = Array.isArray(perm?.allowed_roles)
      ? perm.allowed_roles.map((r: any) => String(r).toLowerCase()).filter(Boolean)
      : [];
    if (list.length) allowedRoles = list;
  }

  if (role !== "admin" && !allowedRoles.includes(role)) {
    return { ok: false as const, error: "NFC role not allowed" };
  }

  const { error: updErr } = await admin
    .from("nfc_access_tags")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tag.id);
  if (updErr) return { ok: false as const, error: updErr.message };

  return { ok: true as const, role };
}
