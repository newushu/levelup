import { supabaseServer } from "./supabase/server";

export async function requireUser() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user) {
    return { ok: false as const, error: error?.message || "Not authenticated" };
  }

  return { ok: true as const, user };
}

export async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  if (error || !user) {
    return { ok: false as const, error: error?.message || "Not authenticated" };
  }

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (rErr) {
    return { ok: false as const, error: rErr.message };
  }

  const isAdmin = (roles ?? []).some((r: any) => String(r.role ?? "").toLowerCase() === "admin");
  if (!isAdmin) {
    return { ok: false as const, error: "Admin access required" };
  }

  return { ok: true as const, user };
}
