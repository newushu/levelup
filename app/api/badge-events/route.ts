import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  type: "achievement" | "prestige" | "challenge";
  student_id: string;
  student_name: string;
  badge_name: string;
  badge_icon_url: string | null;
  points_awarded: number | null;
  created_at: string;
};

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? 20)));

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role,student_id")
    .eq("user_id", auth.user.id);

  const roleList = (roles ?? []).map((r) => String(r.role ?? "").toLowerCase());
  const isStudent = roleList.includes("student");
  const isAdminOrCoach = roleList.some((r) => r === "admin" || r === "coach" || r === "classroom");
  const studentId = isStudent
    ? String((roles ?? []).find((r) => String(r.role ?? "").toLowerCase() === "student")?.student_id ?? "")
    : "";

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const resolveIcon = (iconPath: string | null, libraryUrl: string | null) => {
    if (libraryUrl) return libraryUrl;
    const raw = String(iconPath ?? "").trim();
    if (!raw || !baseUrl) return null;
    const clean = raw.replace(/^\/+/, "");
    const fullPath = clean.startsWith("badges/") ? clean : `badges/${clean}`;
    return `${baseUrl}/storage/v1/object/public/${fullPath}`;
  };

  let badgeQuery = supabase
    .from("student_achievement_badges")
    .select(
      "id,student_id,earned_at,rescinded_at,points_awarded,students(name),achievement_badges(name,category,icon_path,badge_library:badge_library_id(image_url),points_award)"
    )
    .is("rescinded_at", null)
    .order("earned_at", { ascending: false })
    .limit(limit);

  let challengeQuery = supabase
    .from("student_challenges")
    .select("id,student_id,completed_at,points_awarded,students(name),challenges(name,tier,points_awarded)")
    .eq("completed", true)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (isStudent && studentId) {
    badgeQuery = badgeQuery.eq("student_id", studentId);
    challengeQuery = challengeQuery.eq("student_id", studentId);
  } else if (!isAdminOrCoach) {
    return NextResponse.json({ ok: true, events: [] });
  }

  const [badgeRes, challengeRes] = await Promise.all([badgeQuery, challengeQuery]);
  if (badgeRes.error) return NextResponse.json({ ok: false, error: badgeRes.error.message }, { status: 500 });
  if (challengeRes.error) return NextResponse.json({ ok: false, error: challengeRes.error.message }, { status: 500 });

  const badgeEvents: EventRow[] = (badgeRes.data ?? []).map((row: any) => {
    const category = String(row?.achievement_badges?.category ?? "").toLowerCase();
    const type = category === "prestige" ? "prestige" : "achievement";
    return {
      id: String(row.id),
      type,
      student_id: String(row.student_id),
      student_name: String(row.students?.name ?? "Student"),
      badge_name: String(row.achievement_badges?.name ?? "Badge"),
      badge_icon_url: resolveIcon(row.achievement_badges?.icon_path ?? null, row.achievement_badges?.badge_library?.image_url ?? null),
      points_awarded:
        row.points_awarded !== null && row.points_awarded !== undefined
          ? Number(row.points_awarded)
          : row.achievement_badges?.points_award ?? null,
      created_at: String(row.earned_at ?? new Date().toISOString()),
    };
  });

  const challengeEvents: EventRow[] = (challengeRes.data ?? []).map((row: any) => ({
    id: String(row.id),
    type: "challenge",
    student_id: String(row.student_id),
    student_name: String(row.students?.name ?? "Student"),
    badge_name: String(row.challenges?.name ?? "Challenge"),
    badge_icon_url: null,
    points_awarded:
      row.points_awarded !== null && row.points_awarded !== undefined
        ? Number(row.points_awarded)
        : row.challenges?.points_awarded ?? null,
    created_at: String(row.completed_at ?? new Date().toISOString()),
  }));

  const events = [...badgeEvents, ...challengeEvents]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);

  return NextResponse.json({ ok: true, events });
}
