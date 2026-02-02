import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const body = await req.json().catch(() => ({}));
  const student_id = String(body?.student_id ?? "").trim();
  const limit = Math.max(1, Math.min(50, Number(body?.limit ?? 5)));

  if (!student_id) return NextResponse.json({ ok: false, error: "Missing student_id" }, { status: 400 });

  const initial = await supabase
    .from("student_achievement_badges")
    .select(
      "badge_id,earned_at,source,award_note,points_awarded,achievement_badges(name,description,category,icon_path,criteria_type,criteria_json,points_award,badge_library:badge_library_id(image_url))"
    )
    .eq("student_id", student_id)
    .order("earned_at", { ascending: false })
    .limit(limit);
  let data = initial.data as any[] | null;
  let error = initial.error;

  if (error && (String(error.message || "").includes("relationship") || String(error.message || "").includes("column"))) {
    const retry = await supabase
      .from("student_achievement_badges")
      .select(
        "badge_id,earned_at,source,award_note,points_awarded,achievement_badges(name,description,category,icon_path,criteria_type,criteria_json,points_award)"
      )
      .eq("student_id", student_id)
      .order("earned_at", { ascending: false })
      .limit(limit);
    data = retry.data as any[] | null;
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
