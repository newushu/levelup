import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("camp_leaders")
    .select("id,student_id,start_date,end_date,enabled,created_at,students(name)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    leaders: (data ?? []).map((row: any) => ({
      ...row,
      student_name: row?.students?.name ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const leaders = Array.isArray(body?.leaders) ? body.leaders : [];
  if (!leaders.length) return NextResponse.json({ ok: false, error: "Missing leaders" }, { status: 400 });

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const rows = leaders.map((leader: any) => {
    const rawId = String(leader.id ?? "").trim();
    const id = isUuid(rawId) ? rawId : "";
    return {
      ...(id ? { id } : {}),
      student_id: String(leader.student_id ?? "").trim(),
      start_date: String(leader.start_date ?? "").trim(),
      end_date: String(leader.end_date ?? "").trim() || null,
      enabled: leader.enabled !== false,
    };
  });

  if (rows.some((r: any) => !r.student_id || !r.start_date)) {
    return NextResponse.json({ ok: false, error: "student_id and start_date required" }, { status: 400 });
  }

  const { error } = await supabase.from("camp_leaders").upsert(rows, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, updated: rows.length });
}
