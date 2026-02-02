import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json();
  const { student_id, category, points, note, source_type, source_id } = body;

  if (!student_id || !category || typeof points !== "number" || !note) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = await supabaseServer();

  const { error } = await supabase.from("ledger_entries").insert({
    student_id,
    category,
    points,
    note,
    source_type: source_type ?? "manual",
    source_id: source_id ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
