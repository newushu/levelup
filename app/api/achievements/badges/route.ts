import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();

  const initial = await supabase
    .from("achievement_badges")
    .select("id,name,description,category,icon_path,criteria_json,criteria_type,enabled,points_award,icon_zoom,badge_library:badge_library_id(image_url)")
    .eq("enabled", true)
    .order("category", { ascending: true })
    .order("id", { ascending: true });
  let data = initial.data as any[] | null;
  let error = initial.error;

  if (error && (String(error.message || "").includes("relationship") || String(error.message || "").includes("column"))) {
    const retry = await supabase
      .from("achievement_badges")
      .select("id,name,description,category,icon_path,criteria_json,criteria_type,enabled,points_award,icon_zoom")
      .eq("enabled", true)
      .order("category", { ascending: true })
      .order("id", { ascending: true });
    data = retry.data as any[] | null;
    error = retry.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const withUrls =
    (data ?? []).map((b: any) => {
      const libraryUrl = String(b?.badge_library?.image_url ?? "").trim();
      if (libraryUrl) return { ...b, icon_url: libraryUrl };
      const iconPath = String(b?.icon_path ?? "").trim();
      if (!iconPath || !baseUrl) return { ...b, icon_url: null };

      const clean = iconPath.replace(/^\/+/, "");
      const fullPath = clean.startsWith("badges/") ? clean : `badges/${clean}`;
      return { ...b, icon_url: `${baseUrl}/storage/v1/object/public/${fullPath}` };
    }) ?? [];

  return NextResponse.json({ ok: true, badges: withUrls });
}
