import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = await supabaseServer();
  const admin = supabaseAdmin();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: roles, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  if (roleErr) return NextResponse.json({ ok: false, error: roleErr.message }, { status: 500 });
  const roleList = (roles ?? []).map((r: any) => String(r.role ?? "").toLowerCase());
  if (!roleList.some((r) => ["admin", "coach", "classroom"].includes(r))) {
    return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
  }

  const { data, error } = await admin
    .from("class_emotes")
    .select("id,emote_key,label,emoji,image_url,html,css,js,scale,duration_ms,points_cost,unlock_level,enabled")
    .eq("enabled", true)
    .order("is_default", { ascending: false })
    .order("label", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    emotes: (data ?? []).map((row: any) => ({
      id: String(row.id),
      key: String(row.emote_key ?? ""),
      label: String(row.label ?? "Emote"),
      emoji: String(row.emoji ?? "✨"),
      image_url: row.image_url ?? null,
      html: row.html ?? "",
      css: row.css ?? "",
      js: row.js ?? "",
      scale: Number(row.scale ?? 1),
      duration_ms: Number(row.duration_ms ?? 3000),
      points_cost: Number(row.points_cost ?? 0),
      unlock_level: Number(row.unlock_level ?? 1),
    })),
  });
}
