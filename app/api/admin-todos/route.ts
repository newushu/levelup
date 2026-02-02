import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireRole(roleSet: string[]) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) return { ok: false as const, error: error.message };
  const user = data?.user ?? null;
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: roles, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (rErr) return { ok: false as const, error: rErr.message };

  const hasRole = (roles ?? []).some((r: any) => roleSet.includes(String(r.role ?? "").toLowerCase()));
  if (!hasRole) return { ok: false as const, error: "Forbidden" };
  return { ok: true as const, user, supabase, roles: roles ?? [] };
}

export async function GET(req: Request) {
  const gate = await requireRole(["admin", "coach"]);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const { user, roles } = gate;
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  const isAdmin = roleList.includes("admin");

  const url = new URL(req.url);
  const status = String(url.searchParams.get("status") ?? "open").toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 100)));
  const scope = String(url.searchParams.get("scope") ?? "").toLowerCase();

  const admin = supabaseAdmin();
  let query = admin
    .from("admin_todos")
    .select("id,kind,title,body,urgency,student_id,created_by,created_at,resolved_by,resolved_at,students(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "open" || status === "done") query = query.eq("status", status);
  if (!isAdmin || scope === "mine") query = query.eq("created_by", user.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const todos = (data ?? []).map((row: any) => ({
    ...row,
    student_name: row?.students?.name ?? null,
  }));

  return NextResponse.json({ ok: true, todos });
}

export async function POST(req: Request) {
  const gate = await requireRole(["admin", "coach"]);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const { user } = gate;
  const admin = supabaseAdmin();

  const body = await req.json().catch(() => ({}));
  const kind = String(body?.kind ?? "feature").toLowerCase();
  const title = String(body?.title ?? "").trim();
  const text = String(body?.body ?? "").trim();
  const urgency = String(body?.urgency ?? "normal").toLowerCase();
  const student_id = String(body?.student_id ?? "").trim();

  if (!title) return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
  if (!text) return NextResponse.json({ ok: false, error: "Body is required" }, { status: 400 });
  if (!["feature", "bug", "other", "todo"].includes(kind)) {
    return NextResponse.json({ ok: false, error: "Invalid kind" }, { status: 400 });
  }
  if (!["low", "normal", "high", "urgent"].includes(urgency)) {
    return NextResponse.json({ ok: false, error: "Invalid urgency" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("admin_todos")
    .insert({ kind, title, body: text, urgency, student_id: student_id || null, status: "open", created_by: user.id })
    .select("id,kind,title,body,urgency,student_id,status,created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, todo: data });
}
