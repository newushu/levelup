import { requireUser } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ParentRow = {
  id: string;
  name?: string | null;
  auth_user_id?: string | null;
};

export async function resolveParentContext(req: Request): Promise<
  | { ok: true; parent: ParentRow; isAdmin: boolean; userId: string }
  | { ok: false; status: number; error: string }
> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, status: 401, error: gate.error };

  const admin = supabaseAdmin();
  const { data: roles, error: rErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", gate.user.id);
  if (rErr) return { ok: false, status: 500, error: rErr.message };

  const isAdmin = (roles ?? []).some((r: any) => String(r.role ?? "").toLowerCase() === "admin");
  const url = new URL(req.url);
  const parentId = String(url.searchParams.get("parent_id") ?? "").trim();

  let parent: ParentRow | null = null;
  if (parentId) {
    if (!isAdmin) return { ok: false, status: 403, error: "Parent access only" };
    const { data, error } = await admin
      .from("parents")
      .select("id,name,auth_user_id")
      .eq("id", parentId)
      .maybeSingle();
    if (error) return { ok: false, status: 500, error: error.message };
    if (!data?.id) return { ok: false, status: 404, error: "Parent not found" };
    parent = data as ParentRow;
  } else {
    const { data, error } = await admin
      .from("parents")
      .select("id,name,auth_user_id")
      .eq("auth_user_id", gate.user.id)
      .maybeSingle();
    if (error) return { ok: false, status: 500, error: error.message };
    if (!data?.id) return { ok: false, status: 403, error: "Not a parent account" };
    parent = data as ParentRow;
  }

  return { ok: true, parent, isAdmin, userId: gate.user.id };
}
