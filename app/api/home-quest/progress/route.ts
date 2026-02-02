import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const DEFAULT_MAX = 50;

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const { data: settings } = await supabase
    .from("home_quest_settings")
    .select("max_points")
    .eq("id", "default")
    .maybeSingle();

  const max = Number(settings?.max_points ?? DEFAULT_MAX);

  const { data: ledgerRows, error } = await supabase
    .from("ledger")
    .select("points")
    .eq("student_id", student_id)
    .eq("category", "home_quest");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const total = (ledgerRows ?? []).reduce((sum: number, row: any) => sum + Number(row.points ?? 0), 0);
  return NextResponse.json({ ok: true, total, max });
}
