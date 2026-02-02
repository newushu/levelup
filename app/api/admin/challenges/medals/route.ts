import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: "Not logged in" };

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "admin")
    .limit(1);

  if (error) return { ok: false as const, error: error.message };
  if (!roles || roles.length === 0) return { ok: false as const, error: "Admin access required" };

  return { ok: true as const };
}

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const [{ data: medals, error: mErr }, { data: files, error: fErr }, { data: library, error: lErr }] = await Promise.all([
    admin.from("challenge_medal_assets").select("tier,badge_library_id").order("tier", { ascending: true }),
    admin.storage.from("badges").list("challenge", { limit: 200, sortBy: { column: "name", order: "asc" } }),
    admin.from("badge_library").select("id,name,image_url,category,enabled").eq("category", "challenge").order("name", { ascending: true }),
  ]);

  if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
  if (fErr) return NextResponse.json({ ok: false, error: fErr.message }, { status: 500 });
  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const fileItems = (files ?? [])
    .filter((item) => item.name)
    .map((item) => {
      const path = `challenge/${item.name}`;
      const publicUrl = base ? `${base}/storage/v1/object/public/badges/${path}` : "";
      return {
        path,
        name: item.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
        image_url: publicUrl,
        enabled: true,
      };
    });

  const existingByUrl = new Map((library ?? []).map((b: any) => [String(b.image_url ?? ""), b]));
  const missing = fileItems.filter((f) => f.image_url && !existingByUrl.has(f.image_url));

  if (missing.length) {
    const toInsert = missing.map((m) => ({
      name: m.name,
      image_url: m.image_url,
      category: "challenge",
      enabled: true,
    }));
    const { error: insErr } = await admin.from("badge_library").insert(toInsert);
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  const { data: library2, error: l2Err } = await admin
    .from("badge_library")
    .select("id,name,image_url,category,enabled")
    .eq("category", "challenge")
    .order("name", { ascending: true });
  if (l2Err) return NextResponse.json({ ok: false, error: l2Err.message }, { status: 500 });

  return NextResponse.json({ ok: true, medals: medals ?? [], badgeLibrary: library2 ?? [] });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const tier = String(body?.tier ?? "").trim().toLowerCase();
  const badge_library_id = String(body?.badge_library_id ?? "").trim();

  if (!tier) return NextResponse.json({ ok: false, error: "Tier is required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("challenge_medal_assets")
    .upsert({ tier, badge_library_id: badge_library_id || null }, { onConflict: "tier" })
    .select("tier,badge_library_id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, medal: data });
}
