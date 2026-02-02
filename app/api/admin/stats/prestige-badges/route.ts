import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 403 });

  const admin = supabaseAdmin();
  const { data: earned, error: eErr } = await admin
    .from("student_achievement_badges")
    .select("student_id,badge_id,earned_at")
    .order("earned_at", { ascending: false });

  if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 });

  const studentIds = Array.from(
    new Set((earned ?? []).map((row: any) => String(row.student_id ?? "").trim()).filter(Boolean))
  );

  const { data: badges, error: bErr } = await admin
    .from("achievement_badges")
    .select("id,name,category,icon_path,badge_library_id")
    .eq("category", "prestige")
    .order("name", { ascending: true });

  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

  const { data: students, error: sErr } = studentIds.length
    ? await admin.from("students").select("id,name").in("id", studentIds)
    : { data: [], error: null };

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 });

  const prestigeBadges = badges ?? [];
  const libraryIds = Array.from(
    new Set(prestigeBadges.map((b: any) => String(b.badge_library_id ?? "").trim()).filter(Boolean))
  );
  const { data: libraryRows, error: lErr } = libraryIds.length
    ? await admin.from("badge_library").select("id,image_url").in("id", libraryIds)
    : { data: [], error: null };

  if (lErr) return NextResponse.json({ ok: false, error: lErr.message }, { status: 500 });

  const libraryById = new Map((libraryRows ?? []).map((row: any) => [String(row.id), row.image_url ?? ""]));
  const studentById = new Map((students ?? []).map((row: any) => [String(row.id), row.name ?? "Student"]));

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const badgeMeta = new Map(
    prestigeBadges.map((b: any) => {
      const rawIconPath = String(b.icon_path ?? "").trim();
      const clean = rawIconPath.replace(/^\/+/, "");
      const fullPath = clean && clean.startsWith("badges/") ? clean : clean ? `badges/${clean}` : "";
      const libraryUrl = libraryById.get(String(b.badge_library_id ?? "")) ?? "";
      const iconUrl = libraryUrl || (baseUrl && fullPath ? `${baseUrl}/storage/v1/object/public/${fullPath}` : "");
      return [String(b.id), { id: String(b.id), name: b.name ?? "Prestige Badge", icon_url: iconUrl }];
    })
  );

  const rows = (earned ?? []).filter((row: any) => badgeMeta.has(String(row.badge_id ?? "")));
  const summary: Record<
    string,
    { id: string; name: string; icon_url: string; count: number; holders: Array<{ student_id: string; name: string; earned_at: string | null }> }
  > = {};

  prestigeBadges.forEach((badge: any) => {
    const badgeId = String(badge.id ?? "");
    const meta = badgeMeta.get(badgeId);
    if (!meta) return;
    summary[badgeId] = { ...meta, count: 0, holders: [] };
  });
  rows.forEach((row: any) => {
    const badgeId = String(row.badge_id ?? "");
    const studentId = String(row.student_id ?? "");
    if (!badgeId || !studentId) return;
    if (!summary[badgeId]) return;
    summary[badgeId].count += 1;
    summary[badgeId].holders.push({
      student_id: studentId,
      name: studentById.get(studentId) ?? "Student",
      earned_at: row.earned_at ?? null,
    });
  });

  return NextResponse.json({
    ok: true,
    badges: Object.values(summary).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  });
}
