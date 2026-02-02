import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data, error } = await supabase
    .from("student_avatar_settings")
    .select("avatar_id");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: any) => {
    const id = String(row.avatar_id ?? "").trim();
    if (!id) return;
    counts[id] = (counts[id] ?? 0) + 1;
  });

  return NextResponse.json({ ok: true, counts });
}
