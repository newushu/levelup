import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";


export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });


  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const avatar_base = String(body?.avatar_base ?? "").trim(); // storage path, e.g. "dragon/dragon_avatar_1.png"


  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });
  if (!avatar_base) return NextResponse.json({ ok: false, error: "Missing avatar_base" }, { status: 400 });


  // Validate avatar exists + enabled by storage_path
  const { data: av, error: avErr } = await supabase
    .from("avatars")
    .select("id,storage_path")
    .eq("storage_path", avatar_base)
    .eq("enabled", true)
    .maybeSingle();


  if (avErr) return NextResponse.json({ ok: false, error: avErr.message }, { status: 500 });
  if (!av) return NextResponse.json({ ok: false, error: "Avatar not found or disabled" }, { status: 400 });


  // Upsert settings row (do NOT manually set updated_at if you have a trigger; but it's OK if column exists)
  const { error } = await supabase
    .from("student_avatar_settings")
    .upsert(
      {
        student_id,
        avatar_base, // storage path string
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id" }
    );


  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });


  const { data: settings, error: sErr } = await supabase
    .from("student_avatar_settings")
    .select("student_id,avatar_base,bg_color,border_color,glow_color,pattern,particle_style,aura_style,planet_style,updated_at")
    .eq("student_id", student_id)
    .maybeSingle();


  if (sErr) return NextResponse.json({ ok: true, settings: null }, { status: 200 });
  return NextResponse.json({ ok: true, settings });
}
