import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { checkin_id } = await req.json();
  if (!checkin_id) return NextResponse.json({ ok: false, error: "Missing checkin_id" }, { status: 400 });

  const { error } = await supabase.from("checkins").delete().eq("id", checkin_id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
