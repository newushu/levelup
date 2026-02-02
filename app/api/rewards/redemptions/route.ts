import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { student_id } = await req.json();
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("reward_redemptions")
    .select("reward_id,status")
    .eq("student_id", student_id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  const pending: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = String((row as any)?.reward_id ?? "").trim();
    if (!id) continue;
    const status = String((row as any)?.status ?? "approved").toLowerCase();
    if (status === "pending") {
      pending[id] = (pending[id] ?? 0) + 1;
      continue;
    }
    if (status === "rejected") continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }

  return NextResponse.json({ ok: true, counts, pending });
}
