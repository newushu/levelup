import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const url = new URL(req.url);
  const type = String(url.searchParams.get("type") ?? "").trim().toLowerCase();

  const now = new Date().toISOString();
  let query = supabase
    .from("announcements")
    .select("id,title,body,status,starts_at,ends_at,created_at,announcement_type,announcement_kind,discount_label,discount_ends_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (type) {
    query = query.eq("announcement_type", type);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const filtered = (data ?? []).filter((row: any) => {
    const startOk = !row.starts_at || row.starts_at <= now;
    const endOk = !row.ends_at || row.ends_at >= now;
    return startOk && endOk;
  });
  return NextResponse.json({ ok: true, announcements: filtered });
}
