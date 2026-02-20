import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getSession();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  const token = String(data.session?.access_token ?? "");
  if (!token) return NextResponse.json({ ok: false, error: "No session token" }, { status: 401 });
  return NextResponse.json({ ok: true, access_token: token });
}

