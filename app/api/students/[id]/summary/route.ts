import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const { data: student, error: sErr } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const { data: ledger, error: lErr } = await supabase
    .from("ledger_entries")
    .select("points, note, created_at")
    .eq("student_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  const lifetime = (ledger ?? []).reduce((a, e) => a + (e.points ?? 0), 0);

  return NextResponse.json({ student, ledger: ledger ?? [], lifetime });
}
