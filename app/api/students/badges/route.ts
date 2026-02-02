import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const body = await req.json();
  const student_id = body.student_id as string;
  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  let { data, error } = await supabase
    .from("student_achievement_badges")
    .select("badge_id, earned_at, rescinded_at, achievement_badges:badge_id (id,name,description,category,icon_path,points_award,badge_library:badge_library_id(image_url))")
    .eq("student_id", student_id)
    .order("earned_at", { ascending: false });

  if (error && (String(error.message || "").includes("relationship") || String(error.message || "").includes("column"))) {
    const retry = await supabase
      .from("student_achievement_badges")
      .select("badge_id, earned_at, rescinded_at, achievement_badges:badge_id (id,name,description,category,icon_path,points_award)")
      .eq("student_id", student_id)
      .order("earned_at", { ascending: false });
    data = (retry.data ?? []).map((row: any) => ({
      ...row,
      achievement_badges: { ...row.achievement_badges, badge_library: [] },
    }));
    error = retry.error;
  }

  if (error && String(error.message || "").includes("icon_path")) {
    const retry = await supabase
      .from("student_achievement_badges")
      .select("badge_id, earned_at, rescinded_at, achievement_badges:badge_id (id,name,description,category,points_award)")
      .eq("student_id", student_id)
      .order("earned_at", { ascending: false });
    data = (retry.data ?? []).map((row: any) => ({
      ...row,
      achievement_badges: { ...row.achievement_badges, icon_path: null, badge_library: [] },
    }));
    error = retry.error;
  }

  if (error && String(error.message || "").includes("rescinded_at")) {
    const retry = await supabase
      .from("student_achievement_badges")
      .select("badge_id, earned_at, achievement_badges:badge_id (id,name,description,category,icon_path,points_award,badge_library:badge_library_id(image_url))")
      .eq("student_id", student_id)
      .order("earned_at", { ascending: false });
    data = (retry.data ?? []).map((row: any) => ({ ...row, rescinded_at: null }));
    error = retry.error;
  }

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const earned =
    (data ?? []).map((row: any) => {
      const libraryUrl = String(row?.achievement_badges?.badge_library?.image_url ?? "").trim();
      if (libraryUrl) {
        return {
          ...row,
          achievement_badges: {
            ...row.achievement_badges,
            icon_url: libraryUrl,
          },
        };
      }
      const iconPath = String(row?.achievement_badges?.icon_path ?? "").trim();
      const clean = iconPath.replace(/^\/+/, "");
      const fullPath = clean && clean.startsWith("badges/") ? clean : clean ? `badges/${clean}` : "";
      const icon_url = baseUrl && fullPath ? `${baseUrl}/storage/v1/object/public/${fullPath}` : null;
      return {
        ...row,
        achievement_badges: {
          ...row.achievement_badges,
          icon_url,
        },
      };
    }) ?? [];

  return NextResponse.json({ ok: true, earned });
}
