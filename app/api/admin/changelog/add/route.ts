import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({}));
  const page = String(body?.page ?? "").trim().slice(0, 120);
  const category = String(body?.category ?? "General").trim().slice(0, 60) || "General";
  const summary = String(body?.summary ?? "").trim().slice(0, 500);

  if (!summary) return NextResponse.json({ ok: false, error: "Summary is required" }, { status: 400 });

  const { error } = await supabase.from("admin_change_log").insert({
    page: page || "General",
    category,
    summary,
    created_by: auth.user.id,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
