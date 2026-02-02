import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

async function requireRole(roleSet: string[]) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) return { ok: false as const, error: error.message };
  const user = data?.user ?? null;
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const hasRole = (roles ?? []).some((r: any) => roleSet.includes(String(r.role ?? "").toLowerCase()));
  if (!hasRole) return { ok: false as const, error: "Forbidden" };
  return { ok: true as const, user, supabase };
}

export async function GET(req: Request) {
  const gate = await requireRole(["admin", "coach"]);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });
  const { supabase } = gate;

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));
  const statusParam = String(url.searchParams.get("status") ?? "open").toLowerCase();
  const countOnly = url.searchParams.get("count") === "1";
  const studentId = String(url.searchParams.get("student_id") ?? "").trim();

  if (countOnly) {
    let countQuery = supabase
      .from("student_notes")
      .select("id", { count: "exact", head: true })
      .eq("category", "todo");
    if (statusParam !== "all") {
      countQuery = countQuery.eq("status", statusParam === "done" ? "done" : "open");
    }
    const { count, error } = await countQuery;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: count ?? 0 });
  }

  let query = supabase
    .from("student_notes")
    .select("id,student_id,body,urgency,status,created_at,completed_at,students(name)")
    .eq("category", "todo")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusParam !== "all") {
    query = query.eq("status", statusParam === "done" ? "done" : "open");
  }
  if (studentId) {
    query = query.eq("student_id", studentId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows =
    (data ?? []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      student_name: row.students?.name ?? "Student",
      body: row.body,
      urgency: row.urgency,
      status: row.status,
      created_at: row.created_at,
      completed_at: row.completed_at ?? null,
    })) ?? [];

  return NextResponse.json({ ok: true, todos: rows });
}
