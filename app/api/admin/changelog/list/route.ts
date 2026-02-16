import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: roles, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });

  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  if (!roleList.includes("admin") && !roleList.includes("coach")) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("admin_change_log")
    .select("id,page,category,summary,created_at")
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, entries: data ?? [] });
}
